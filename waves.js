const main = () => {
  const simulatorCanvas = document.getElementById(SIMULATOR_CANVAS_ID);
  const overlayDiv = document.getElementById(OVERLAY_DIV_ID);
  const uiDiv = document.getElementById(UI_DIV_ID);
  const cameraDiv = document.getElementById(CAMERA_DIV_ID);
  const windDiv = document.getElementById(WIND_SPEED_DIV_ID);
  const windSpeedSpan = document.getElementById(WIND_SPEED_SPAN_ID);
  const choppinessDiv = document.getElementById(CHOPPINESS_DIV_ID);
  const sizeSpan = document.getElementById('size-value');

  setText(choppinessDiv, INITIAL_CHOPPINESS, CHOPPINESS_DECIMAL_PLACES);
  setText(sizeSpan, INITIAL_SIZE, SIZE_DECIMAL_PLACES);

  const camera = new Camera();
  const projectionMatrix = makePerspectiveMatrix(new Float32Array(16), FOV, MIN_ASPECT, NEAR, FAR);

  const simulator = new Simulator(simulatorCanvas, window.innerWidth, window.innerHeight);

  const profile = new Profile(document.getElementById(PROFILE_CANVAS_ID));

  const sizeSlider = new Slider(
    cameraDiv, SIZE_SLIDER_X, SIZE_SLIDER_Z,
    SIZE_SLIDER_LENGTH, MIN_SIZE, MAX_SIZE, INITIAL_SIZE, SIZE_SLIDER_BREADTH, SIZE_HANDLE_SIZE
  );

  const choppinessSlider = new Slider(
    cameraDiv, CHOPPINESS_SLIDER_X, CHOPPINESS_SLIDER_Z,
    CHOPPINESS_SLIDER_LENGTH, MIN_CHOPPINESS, MAX_CHOPPINESS, INITIAL_CHOPPINESS, CHOPPINESS_SLIDER_BREADTH, CHOPPINESS_HANDLE_SIZE
  );

  let width = window.innerWidth;
  let height = window.innerHeight;

  let lastMouseX = 0;
  let lastMouseY = 0;
  let mode = NONE;

  const setUIPerspective = (height) => {
    const fovValue = 0.5 / Math.tan(FOV / 2) * height;
    setPerspective(uiDiv, `${fovValue}px`);
  };

  const windArrow = new Arrow(cameraDiv, INITIAL_WIND[0], INITIAL_WIND[1]);
  setText(windSpeedSpan, windArrow.getValue(), WIND_SPEED_DECIMAL_PLACES);
  setTransform(windDiv, `translate3d(${WIND_SPEED_X}px, 0px, ${Math.max(MIN_WIND_SPEED_Z, windArrow.getTipZ() + WIND_SPEED_OFFSET)}px) rotateX(90deg)`);

  const inverseProjectionViewMatrix = [];
  const nearPoint = [];
  const farPoint = [];
  const unproject = (viewMatrix, x, y, width, height) => {
    premultiplyMatrix(inverseProjectionViewMatrix, viewMatrix, projectionMatrix);
    invertMatrix(inverseProjectionViewMatrix, inverseProjectionViewMatrix);

    setVector4(nearPoint, (x / width) * 2.0 - 1.0, ((height - y) / height) * 2.0 - 1.0, 1.0, 1.0);
    transformVectorByMatrix(nearPoint, nearPoint, inverseProjectionViewMatrix);

    setVector4(farPoint, (x / width) * 2.0 - 1.0, ((height - y) / height) * 2.0 - 1.0, -1.0, 1.0);
    transformVectorByMatrix(farPoint, farPoint, inverseProjectionViewMatrix);

    projectVector4(nearPoint, nearPoint);
    projectVector4(farPoint, farPoint);

    const t = -nearPoint[1] / (farPoint[1] - nearPoint[1]);
    const point = [
      nearPoint[0] + t * (farPoint[0] - nearPoint[0]),
      nearPoint[1] + t * (farPoint[1] - nearPoint[1]),
      nearPoint[2] + t * (farPoint[2] - nearPoint[2])
    ];

    return point;
  };

  const onMouseDown = (event) => {
    event.preventDefault();

    const mousePosition = getMousePosition(event, uiDiv);
    const mouseX = mousePosition.x;
    const mouseY = mousePosition.y;

    const point = unproject(camera.getViewMatrix(), mouseX, mouseY, width, height);

    if (windArrow.distanceToTip(point) < ARROW_TIP_RADIUS) {
      mode = ROTATING;
    } else if (sizeSlider.distanceToHandle(point) < SIZE_HANDLE_RADIUS) {
      mode = SLIDING_SIZE;
    } else if (choppinessSlider.distanceToHandle(point) < CHOPPINESS_HANDLE_RADIUS) {
      mode = SLIDING_CHOPPINESS;
    } else {
      mode = ORBITING;
      lastMouseX = mouseX;
      lastMouseY = mouseY;
    }
  };
  overlayDiv.addEventListener('mousedown', onMouseDown, false);

  overlayDiv.addEventListener('mousemove', (event) => {
    event.preventDefault();

    const mousePosition = getMousePosition(event, uiDiv);
    const mouseX = mousePosition.x;
    const mouseY = mousePosition.y;

    const point = unproject(camera.getViewMatrix(), mouseX, mouseY, width, height);

    if (windArrow.distanceToTip(point) < ARROW_TIP_RADIUS || mode === ROTATING) {
      overlayDiv.style.cursor = 'move';
    } else if (sizeSlider.distanceToHandle(point) < SIZE_HANDLE_RADIUS ||
            choppinessSlider.distanceToHandle(point) < CHOPPINESS_HANDLE_RADIUS ||
            mode === SLIDING_SIZE || mode === SLIDING_CHOPPINESS) {
      overlayDiv.style.cursor = 'ew-resize';
    } else if (mode === ORBITING) {
      overlayDiv.style.cursor = '-webkit-grabbing';
      overlayDiv.style.cursor = '-moz-grabbing';
      overlayDiv.style.cursor = 'grabbing';
    } else {
      overlayDiv.style.cursor = '-webkit-grab';
      overlayDiv.style.cursor = '-moz-grab';
      overlayDiv.style.cursor = 'grab';
    }

    if (mode === ORBITING) {
      camera.changeAzimuth((mouseX - lastMouseX) / width * SENSITIVITY);
      camera.changeElevation((mouseY - lastMouseY) / height * SENSITIVITY);
      lastMouseX = mouseX;
      lastMouseY = mouseY;
    } else if (mode === ROTATING) {
      windArrow.update(point[0], point[2]);
      simulator.setWind(windArrow.getValueX(), windArrow.getValueY());
      setText(windSpeedSpan, windArrow.getValue(), WIND_SPEED_DECIMAL_PLACES);

      setTransform(windDiv, `translate3d(${WIND_SPEED_X}px, 0px, ${Math.max(MIN_WIND_SPEED_Z, windArrow.getTipZ() + WIND_SPEED_OFFSET)}px) rotateX(90deg)`);
    } else if (mode === SLIDING_SIZE) {
      sizeSlider.update(point[0], (size) => {
        simulator.setSize(size);
        setText(sizeSpan, size, SIZE_DECIMAL_PLACES);
      });
    } else if (mode === SLIDING_CHOPPINESS) {
      choppinessSlider.update(point[0], (choppiness) => {
        simulator.setChoppiness(choppiness);
        setText(choppinessDiv, choppiness, CHOPPINESS_DECIMAL_PLACES);
        profile.render(choppiness);
      });
    }
  });

  overlayDiv.addEventListener('mouseup', (event) => {
    event.preventDefault();
    mode = NONE;
  });

  window.addEventListener('mouseout', (event) => {
    const from = event.relatedTarget || event.toElement;
    if (!from || from.nodeName === 'HTML') {
      mode = NONE;
    }
  });

  const onresize = () => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    overlayDiv.style.width = `${windowWidth}px`;
    overlayDiv.style.height = `${windowHeight}px`;

    if (windowWidth / windowHeight > MIN_ASPECT) {
      makePerspectiveMatrix(projectionMatrix, FOV, windowWidth / windowHeight, NEAR, FAR);
      simulator.resize(windowWidth, windowHeight);
      uiDiv.style.width = `${windowWidth}px`;
      uiDiv.style.height = `${windowHeight}px`;
      cameraDiv.style.width = `${windowWidth}px`;
      cameraDiv.style.height = `${windowHeight}px`;
      simulatorCanvas.style.top = '0px';
      uiDiv.style.top = '0px';
      setUIPerspective(windowHeight);
      width = windowWidth;
      height = windowHeight;
    } else {
      const newHeight = windowWidth / MIN_ASPECT;
      makePerspectiveMatrix(projectionMatrix, FOV, windowWidth / newHeight, NEAR, FAR);
      simulator.resize(windowWidth, newHeight);
      simulatorCanvas.style.top = `${(windowHeight - newHeight) * 0.5}px`;
      uiDiv.style.top = `${(windowHeight - newHeight) * 0.5}px`;
      setUIPerspective(newHeight);
      uiDiv.style.width = `${windowWidth}px`;
      uiDiv.style.height = `${newHeight}px`;
      cameraDiv.style.width = `${windowWidth}px`;
      cameraDiv.style.height = `${newHeight}px`;
      width = windowWidth;
      height = newHeight;
    }
  };

  window.addEventListener('resize', onresize);
  onresize();

  let lastTime = (new Date()).getTime();
  const render = function render(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000 || 0.0;
    lastTime = currentTime;

    const fovValue = 0.5 / Math.tan(FOV / 2) * height;
    setTransform(cameraDiv, `translate3d(0px, 0px, ${fovValue}px) ${toCSSMatrix(camera.getViewMatrix())} translate3d(${width / 2}px, ${height / 2}px, 0px)`);
    simulator.render(deltaTime, projectionMatrix, camera.getViewMatrix(), camera.getPosition());

    requestAnimationFrame(render);
  };
  render();
};

if (hasWebGLSupportWithExtensions(['OES_texture_float', 'OES_texture_float_linear'])) {
  main();
} else {
  document.getElementById('error').style.display = 'block';
  document.getElementById('footer').style.display = 'none';
}
