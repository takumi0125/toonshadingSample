(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  window.project = window.project || {};

  window.isEnabledlog = true;

  window.log = (function() {
    if (window.isEnabledlog) {
      if ((window.console != null) && (window.console.log.bind != null)) {
        return window.console.log.bind(window.console);
      } else {
        return window.alert;
      }
    } else {
      return function() {};
    }
  })();

  window.requestAnimationFrame = ((function(_this) {
    return function() {
      return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || window.oRequestAnimationFrame || function(callback) {
        return setTimeout(callback, 1000 / 60);
      };
    };
  })(this))();

  window.cancelAnimationFrame = ((function(_this) {
    return function() {
      return window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame || window.oCancelAnimationFrame || function(id) {
        return clearTimeout(id);
      };
    };
  })(this))();

  project.ToonShader = (function() {
    ToonShader.prototype.uniforms = {
      edge: {
        type: 'i',
        value: true
      },
      lightPosition: {
        type: 'v3',
        value: null
      }
    };

    ToonShader.prototype.vertexShader = "uniform float edgeWidthRatio;\nuniform bool edge;\nuniform vec3 lightPosition;\n\nvarying vec2 vUv;\nvarying vec3 vEyeDirection;\nvarying vec3 vLightDirection;\n\nvoid main() {\n  vec3 pos = (modelMatrix * vec4(position, 1.0)).xyz;\n  if(edge) { pos += normal * edgeWidthRatio; }\n\n  vec3 eye = cameraPosition - pos;\n  vec3 light = lightPosition - pos;\n\n  vec3 t = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));\n  vec3 b = cross(normal, t);\n\n  vEyeDirection = normalize(vec3(dot(t, eye), dot(b, eye), dot(normal, eye)));\n  vLightDirection = normalize(vec3(dot(t, light), dot(b, light), dot(normal, light)));\n  vUv = uv;\n\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);\n}";

    ToonShader.prototype.fragmentShader = "uniform vec3 lightDirection;\nuniform sampler2D stepTexture;\nuniform sampler2D texture;\nuniform sampler2D normalMap;\nuniform samplerCube envMap;\nuniform bool edge;\nuniform vec4 edgeColor;\n\nvarying vec2 vUv;\nvarying vec3 vEyeDirection;\nvarying vec3 vLightDirection;\n\nvoid main(void){\n  if(edge) {\n    gl_FragColor = edgeColor;\n  } else {\n    vec3 mNormal = (texture2D(normalMap, vUv) * 2.0 - 1.0).rgb;\n    vec3 halfLE = normalize(vLightDirection + vEyeDirection);\n    float s = clamp(dot(mNormal, vLightDirection), 0.1, 1.0);\n    float specular = pow(clamp(dot(mNormal, halfLE), 0.0, 1.0), 100.0);\n\n    gl_FragColor = texture2D(texture, vUv) * texture2D(stepTexture, vec2(s, 1.0)) + vec4(vec3(specular), 1.0);\n  }\n}";

    function ToonShader(stepTexture, texture, normalMap, edgeColor, edgeWidthRatio) {
      if (edgeWidthRatio == null) {
        edgeWidthRatio = 0.3;
      }
      this.uniforms.stepTexture = {
        type: 't',
        value: stepTexture
      };
      this.uniforms.texture = {
        type: 't',
        value: texture
      };
      this.uniforms.normalMap = {
        type: 't',
        value: normalMap
      };
      this.uniforms.edgeColor = {
        type: 'v4',
        value: edgeColor
      };
      this.uniforms.edgeWidthRatio = {
        type: 'f',
        value: edgeWidthRatio
      };
    }

    return ToonShader;

  })();

  project.Main = (function() {
    var _POINT_ZERO;

    _POINT_ZERO = new THREE.Vector3();

    function Main() {
      this.windowResizeHandler = bind(this.windowResizeHandler, this);
      this.update = bind(this.update, this);
      var loader, toonShader;
      this.$window = $(window);
      this.$body = $('body');
      this.time = 0;
      this.$canvas = $('canvas');
      this.canvasElm = this.$canvas.get(0);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, this.$canvas.width() / this.$canvas.height(), 10, 10000);
      this.camera.target = _POINT_ZERO;
      this.camera.position.z = 1000;
      this.sceneEdge = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvasElm,
        antialias: true,
        alpha: true
      });
      this.renderer.autoClear = false;
      this.renderer.shadowMapEnabled = true;
      this.light = new THREE.PointLight(0xffffff, 10, 1000);
      this.light.position.set(0, 200, 500);
      this.scene.add(this.light);
      toonShader = new project.ToonShader(THREE.ImageUtils.loadTexture('assets/img/toonShaderStep.png'), THREE.ImageUtils.loadTexture('assets/img/texture.png'), THREE.ImageUtils.loadTexture('assets/img/normalMap.png'), new THREE.Vector4(0, 0, 0, 1), 1);
      this.toonShaderMaterial = new THREE.ShaderMaterial(toonShader);
      loader = new THREE.OBJLoader();
      loader.load('assets/3d/ecan.obj', (function(_this) {
        return function(obj) {
          var matrix, mesh;
          _this.scene.add(obj);
          obj.scale.set(4, 4, 4);
          mesh = obj.children[0];
          mesh.material = _this.toonShaderMaterial;
          matrix = new THREE.Matrix4();
          matrix.makeRotationX(Math.PI);
          return mesh.geometry.applyMatrix(matrix);
        };
      })(this));
      this.controls = new THREE.TrackballControls(this.camera);
      this.controls.zoomSpeed = 0.4;
      this.update();
      this.$window.on('resize', this.windowResizeHandler).trigger('resize');
    }

    Main.prototype.update = function() {
      this.time += 1;
      this.theta = Math.PI / 180 * this.time;
      this.controls.update();
      this.light.position.set(500 * Math.sin(this.theta), 200, 500 * Math.cos(this.theta));
      this.renderer.clear();
      this.camera.lookAt(this.camera.target);
      this.toonShaderMaterial.uniforms.lightPosition.value = this.light.position;
      this.toonShaderMaterial.side = THREE.BackSide;
      this.toonShaderMaterial.uniforms.edge.value = true;
      this.renderer.render(this.scene, this.camera);
      this.toonShaderMaterial.side = THREE.FrontSide;
      this.toonShaderMaterial.uniforms.edge.value = false;
      this.renderer.render(this.scene, this.camera);
      return requestAnimationFrame(this.update);
    };

    Main.prototype.windowResizeHandler = function(e) {
      var aspect, height, width;
      width = window.innerWidth;
      height = window.innerHeight;
      aspect = width / height;
      this.renderer.setSize(width, height);
      this.renderer.setViewport(0, 0, width, height);
      this.camera.aspect = aspect;
      return this.camera.updateProjectionMatrix();
    };

    return Main;

  })();

  $(function() {
    return new project.Main();
  });

}).call(this);
