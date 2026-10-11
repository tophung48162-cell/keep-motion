// Per-piece picking uses the same geometries and transforms as the rendered ice.
export function installIceInteractions(ice, geometries, api) {
  const { Raycaster, Mesh, Material, tween, events, renderer } = api;
  const ray = new Raycaster();
  const pointer = { x: 0, y: 0 };
  const material = new Material({ side: 2 });
  const proxies = geometries.map((geometry, index) => {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.iceIndex = index;
    ice._objects[index].clickPulse = { value: 0 };
    return mesh;
  });
  const canvas = renderer.domElement;
  let press = null;
  const pick = event => {
    canvas.dataset.pickState = JSON.stringify({visible:ice.mesh.visible,sceneVisible:ice.scene.isSceneVisible,intro:ice.mesh.material.uniforms?.uIntroMaterialize?.value,x:event.clientX,y:event.clientY});
    if (!ice.mesh.visible || ice.scene.isSceneVisible === false ||
        (ice.mesh.material.uniforms?.uIntroMaterialize?.value ?? 1) < 0.95) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
    ice.mesh.updateMatrixWorld(true);
    proxies.forEach((mesh, index) => {
      mesh.matrixWorld.multiplyMatrices(ice.mesh.matrixWorld, ice._objects[index].matrix);
    });
    ray.setFromCamera(pointer, ice.scene.camera);
    return ray.intersectObjects(proxies, false)[0]?.object ?? null;
  };
  window.addEventListener('pointerdown', event => {
    if(event.button !== 0 || event.target.closest?.('button,a,input,textarea,select')) { press = null; return; }
    canvas.dataset.pointerDown = String(Number(canvas.dataset.pointerDown || 0)+1);
    press = { x: event.clientX, y: event.clientY };
  }, true);
  window.addEventListener('pointermove', event => {
    canvas.style.cursor = pick(event) ? 'pointer' : '';
  }, true);
  window.addEventListener('pointerleave', () => { canvas.style.cursor = ''; press = null; });
  window.addEventListener('pointercancel', () => { press = null; });
  window.addEventListener('pointerup', event => {
    if (!press || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) {
      press = null; return;
    }
    press = null;
    const hit = pick(event);
    if (!hit) return;
    const block = ice._objects[hit.iceIndex];
    tween.killTweensOf(block.clickPulse);
    tween.to(block.clickPulse, { value: 1, duration: .28, ease: 'power2.out', overwrite: true,
      onComplete: () => tween.to(block.clickPulse, {value: 0, duration: 1.25, ease: 'sine.inOut', overwrite: true})
    });
    events.emit('webgl_play_audio', 'click-project');
    // Visible DOM diagnostics let us verify real geometry picking without exposing engine internals.
    canvas.dataset.lastIceBlock = String(hit.iceIndex);
    document.getElementById("webgl").dataset.lastIceBlock = String(hit.iceIndex);
    canvas.dataset.iceClicks = String(Number(canvas.dataset.iceClicks || 0) + 1);
  }, true);
  canvas.dataset.interactiveIceBlocks = String(proxies.length);
  document.getElementById("webgl").dataset.interactiveIceBlocks = String(proxies.length);
}
