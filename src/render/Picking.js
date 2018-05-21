// TODO: perhaps render only clicked area
// TODO: no picking if too far, too small (zoom levels)

class Picking {

  constructor () {

    this.size = [512, 512];

    this.shader = new GLX.Shader({
      vertexShader: Shaders.picking.vertex,
      fragmentShader: Shaders.picking.fragment,
      shaderName: 'picking shader',
      attributes: ['aPosition', 'aPickingColor'],
      uniforms: [
        'uModelMatrix',
        'uMatrix',
        'uFogDistance',
        'uFade',
        'uIndex'
      ]
    });

    this.framebuffer = new GLX.Framebuffer(this.size[0], this.size[1]);
  }

  getTarget (x, y, callback) {
    requestAnimationFrame(() => {
      this.shader.enable();
      this.framebuffer.enable();

      GL.viewport(0, 0, this.size[0], this.size[1]);

      GL.clearColor(0, 0, 0, 1);
      GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

      this.shader.setParam('uFogDistance', '1f', render.fogDistance);

      const renderedItems = [];
      APP.features.forEach(item => {
        if (APP.zoom < item.minZoom || APP.zoom > item.maxZoom) {
          return;
        }

        let modelMatrix = item.getMatrix();
        if (!modelMatrix) {
          return;
        }

        renderedItems.push(item.items);

        this.shader.setParam('uFade', '1f', item.getFade());
        this.shader.setParam('uIndex', '1f', renderedItems.length / 256);

        this.shader.setMatrix('uModelMatrix', '4fv', modelMatrix.data);
        this.shader.setMatrix('uMatrix', '4fv', GLX.Matrix.multiply(modelMatrix, render.viewProjMatrix));

        this.shader.setBuffer('aPosition', item.vertexBuffer);
        this.shader.setBuffer('aPickingColor', item.pickingBuffer);

        GL.drawArrays(GL.TRIANGLES, 0, item.vertexBuffer.numItems);
      });

      this.shader.disable();
      GL.viewport(0, 0, APP.width, APP.height);

      //***************************************************

      const
        X = x / APP.width * this.size[0] << 0,
        Y = y / APP.height * this.size[1] << 0;

      const imgData = this.framebuffer.getPixel(X, this.size[1] - 1 - Y);
      this.framebuffer.disable();

      if (!imgData) {
        callback();
        return;
      }

      const
        i = imgData[0] - 1,
        f = (imgData[1] | (imgData[2] << 8)) - 1;

      if (!renderedItems[i] || !renderedItems[i][f]) {
        callback();
        return;
      }

      const feature = renderedItems[i][f];
      // callback({ id: feature.id, properties: feature.properties });

      // find related items - across tiles
      const res = { id: feature.id, properties: feature.properties, parts: [] };
      const id = feature.properties.building || feature.id;
      APP.features.forEach(item => {
        item.items.forEach(feature => {
          if (feature.id === id || feature.properties.building === id) {
            res.parts.push({ id: feature.id, properties: feature.properties });
          }
        });
      });

      callback(res);

    }); // end requestAnimationFrame()
  }

  destroy () {
    this.shader.destroy();
    this.framebuffer.destroy();
  }
}