window.project = window.project || {}

# console.log wrapper
window.isEnabledlog = true
window.log = (->
  if window.isEnabledlog
    if window.console? and window.console.log.bind?
      return window.console.log.bind window.console
    else
      return window.alert
  else ->
)()

# requestAnimationFrame wrapper
window.requestAnimationFrame = (=>
  return  window.requestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame ||
          window.msRequestAnimationFrame ||
          window.oRequestAnimationFrame ||
          (callback)=> return setTimeout(callback, 1000 / 60)
)()

# cancelAnimationFrame wrapper
window.cancelAnimationFrame = (=>
  return  window.cancelAnimationFrame ||
          window.webkitCancelAnimationFrame ||
          window.mozCancelAnimationFrame ||
          window.msCancelAnimationFrame ||
          window.oCancelAnimationFrame ||
          (id)=> return clearTimeout(id)
)()


class project.ToonShader
  uniforms:
    edge: { type: 'i', value: true }
    lightPosition: { type: 'v3', value: null }

  vertexShader: """
uniform float edgeWidthRatio;
uniform bool edge;
uniform vec3 lightPosition;

varying vec2 vUv;
varying vec3 vEyeDirection;
varying vec3 vLightDirection;

void main() {
  vec3 pos = (modelMatrix * vec4(position, 1.0)).xyz;
  if(edge) { pos += normal * edgeWidthRatio; }

  vec3 eye = cameraPosition - pos;
  vec3 light = lightPosition - pos;

  vec3 t = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
  vec3 b = cross(normal, t);

  vEyeDirection = normalize(vec3(dot(t, eye), dot(b, eye), dot(normal, eye)));
  vLightDirection = normalize(vec3(dot(t, light), dot(b, light), dot(normal, light)));
  vUv = uv;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
"""

  fragmentShader: """
uniform vec3 lightDirection;
uniform sampler2D stepTexture;
uniform sampler2D texture;
uniform sampler2D normalMap;
uniform samplerCube envMap;
uniform bool edge;
uniform vec4 edgeColor;

varying vec2 vUv;
varying vec3 vEyeDirection;
varying vec3 vLightDirection;

void main(void){
  if(edge) {
    gl_FragColor = edgeColor;
  } else {
    vec3 mNormal = (texture2D(normalMap, vUv) * 2.0 - 1.0).rgb;
    vec3 halfLE = normalize(vLightDirection + vEyeDirection);
    float s = clamp(dot(mNormal, vLightDirection), 0.1, 1.0);
    float specular = pow(clamp(dot(mNormal, halfLE), 0.0, 1.0), 100.0);

    gl_FragColor = texture2D(texture, vUv) * texture2D(stepTexture, vec2(s, 1.0)) + vec4(vec3(specular), 1.0);
  }
}
"""

  constructor: (stepTexture, texture, normalMap, edgeColor, edgeWidthRatio = 0.3)->
    @uniforms.stepTexture    = { type: 't',  value: stepTexture }
    @uniforms.texture        = { type: 't',  value: texture }
    @uniforms.normalMap      = { type: 't',  value: normalMap }
    @uniforms.edgeColor      = { type: 'v4', value: edgeColor }
    @uniforms.edgeWidthRatio = { type: 'f',  value: edgeWidthRatio }




# ドキュメントクラス
class project.Main
  _POINT_ZERO = new THREE.Vector3()

  constructor: ->
    @$window = $　window
    @$body   = $ 'body'

    @time = 0

    @$canvas = $ 'canvas'
    @canvasElm = @$canvas.get 0

    @scene = new THREE.Scene()
    @camera = new THREE.PerspectiveCamera 35, @$canvas.width() / @$canvas.height(), 10, 10000
    @camera.target = _POINT_ZERO
    @camera.position.z = 1000

    @sceneEdge = new THREE.Scene()

    @renderer = new THREE.WebGLRenderer
      canvas: @canvasElm
      antialias: true
      alpha: true
    @renderer.autoClear = false
    @renderer.shadowMapEnabled = true

    @light = new THREE.PointLight 0xffffff, 10, 1000
    @light.position.set 0, 200, 500
    @scene.add @light

    toonShader = new project.ToonShader(
      THREE.ImageUtils.loadTexture('assets/img/toonShaderStep.png')
      THREE.ImageUtils.loadTexture('assets/img/texture.png')
      THREE.ImageUtils.loadTexture('assets/img/normalMap.png')
      new THREE.Vector4(0, 0, 0, 1)
      1
    )
    @toonShaderMaterial = new THREE.ShaderMaterial toonShader

    loader = new THREE.OBJLoader()
    loader.load 'assets/3d/ecan.obj', (obj)=>
      @scene.add obj
      obj.scale.set 4, 4, 4
      mesh = obj.children[0]
      mesh.material = @toonShaderMaterial

      matrix = new THREE.Matrix4()
      matrix.makeRotationX Math.PI
      mesh.geometry.applyMatrix matrix

    # control
    @controls = new THREE.TrackballControls @camera
    @controls.zoomSpeed = 0.4

    @update()

    @$window.on('resize', @windowResizeHandler).trigger 'resize'



  # 描画更新
  update: =>
    @time += 1
    @theta = Math.PI / 180 * @time

    @controls.update()

    @light.position.set 500 * Math.sin(@theta ), 200, 500 * Math.cos(@theta )

    @renderer.clear()

    @camera.lookAt @camera.target
    @toonShaderMaterial.uniforms.lightPosition.value = @light.position;


    @toonShaderMaterial.side = THREE.BackSide;
    @toonShaderMaterial.uniforms.edge.value = true;
    @renderer.render @scene, @camera

    @toonShaderMaterial.side = THREE.FrontSide;
    @toonShaderMaterial.uniforms.edge.value = false;
    @renderer.render @scene, @camera

    requestAnimationFrame @update


  # ウィンドウリサイズ
  windowResizeHandler: (e)=>
    width = window.innerWidth
    height = window.innerHeight
    aspect = width / height

    @renderer.setSize width, height
    @renderer.setViewport 0, 0, width, height
    @camera.aspect = aspect
    @camera.updateProjectionMatrix()


    # Document Ready
$ -> new project.Main()
