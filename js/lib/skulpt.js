/**
 * @fileOverview A JavaScript sculpting script for sculpting Three.js meshes
 * @author Skeel Lee <skeel@skeelogy.com>
 * @version 0.1.0
 */

//===================================
// SKULPT LAYERS
//===================================

/**
 * Sculpting layer for a SkulptMesh
 * @constructor
 * @param {SkulptMesh} mesh
 */
function SkulptLayer(skulptMesh) {
    this.__skulptMesh = skulptMesh;

    this.data = [];

    this.__init();
}
SkulptLayer.prototype.__init = function () {
    this.clear();
};
SkulptLayer.prototype.loadFromImage = function () {
    //TODO
};
SkulptLayer.prototype.addNoise = function () {
    //TODO
};
SkulptLayer.prototype.clear = function () {
    var i, len;
    for (i = 0, len = this.__skulptMesh.__mesh.geometry.vertices.length; i < len; i++) {
        this.data[i] = 0;
    }
};

//===================================
// SKULPT MESHES
//===================================

/**
 * An abstract class for sculptable meshes
 * @constructor
 * @param {THREE.Mesh} mesh
 */
function SkulptMesh(mesh) {
    this.__mesh = mesh;
    this.__layers = {};
    this.__currLayer = undefined;
    this.__displacements = [];  //need to always keep this in sync

    this.__init();
}
SkulptMesh.prototype.__init = function () {
    var i, len;
    for (i = 0, len = this.__mesh.geometry.vertices.length; i < len; i++) {
        this.__displacements[i] = 0;
    }
};
SkulptMesh.prototype.addLayer = function (name) {
    if (Object.keys(this.__layers).indexOf(name) !== -1) {
        throw new Error('Layer name already exists: ' + name);
    }
    this.__layers[name] = new SkulptLayer(this);
    this.__currLayer = this.__layers[name];
};
SkulptMesh.prototype.removeLayer = function (name) {
    //TODO
};
SkulptMesh.prototype.getCurrLayer = function () {
    return this.__currLayer;
};
SkulptMesh.prototype.setCurrLayer = function () {
    //TODO
};
SkulptMesh.prototype.clearCurrLayer = function () {
    this.__currLayer.clear();
    this.updateAll();
};
SkulptMesh.prototype.getDisplacements = function () {
    return this.__displacements;
};
SkulptMesh.prototype.getAffectedVertexInfo = function (position) {
    throw new Error('Abstract method not implemented');
};
SkulptMesh.prototype.update = function (position) {
    throw new Error('Abstract method not implemented');
};
SkulptMesh.prototype.updateAll = function () {
    throw new Error('Abstract method not implemented');
};

/**
 * A sculptable flat plane mesh
 * @constructor
 * @extends {SkulptMesh}
 * @param {THREE.Mesh} mesh
 * @param {number} size
 * @param {number} res
 */
function SkulptTerrainMesh(mesh, size, res) {
    SkulptMesh.call(this, mesh);
    this.__size = size;
    this.__halfSize = size / 2.0;
    this.__res = res;
    this.__stepSize = size / res;
}
SkulptTerrainMesh.prototype = Object.create(SkulptMesh.prototype);
SkulptTerrainMesh.prototype.constructor = SkulptTerrainMesh;
/**
 * Calculates vertex id on this terrain using x and z values
 * @param  {number} x
 * @param  {number} z
 * @return {number}
 */
SkulptTerrainMesh.prototype.__calcTerrainVertexId = function (x, z) {
    //TODO: take into account world transformations
    var row = Math.floor((z + this.__halfSize) / this.__size * this.__res);
    var col = Math.floor((x + this.__halfSize) / this.__size * this.__res);
    //console.log(row + ' ' + col + ' ' + vertexId);
    return (row * this.__res) + col;
};
SkulptTerrainMesh.prototype.getAffectedVertexInfo = function (position, radius) {

    var centerX = position.x;
    var centerZ = position.z;

    var geom = this.__mesh.geometry;

    //find all vertices that are in radius
    //iterate in the square with width of 2*radius first
    var affectedVertexInfos = [];
    var dist;
    var x, z;
    for (x = -radius; x <= radius; x += this.__stepSize) {
        for (z = -radius; z <= radius; z += this.__stepSize) {
            dist = Math.sqrt(x * x + z * z);
            if (dist < radius) { //within the circle
                //get vertex id for this (x, z) point
                var vertexId = this.__calcTerrainVertexId(centerX + x, centerZ + z);
                var vertex = geom.vertices[vertexId];
                if (vertex) { //check that a vertex with this vertexId exists
                    //add to current layer
                    var vertexInfo = {
                        id: vertexId,
                        weight: dist / radius
                    };
                    affectedVertexInfos.push(vertexInfo);
                }
            }
        }
    }

    return affectedVertexInfos;
};
SkulptTerrainMesh.prototype.update = function (affectedVertexInfos) {

    var geom = this.__mesh.geometry;

    var affectedVertexInfo;
    var i, len;
    for (i = 0, len = affectedVertexInfos.length; i < len; i++) {

        affectedVertexInfo = affectedVertexInfos[i];

        //sum all layers
        var layer, layerName;
        var sum = 0;
        for (layerName in this.__layers) {
            if (this.__layers.hasOwnProperty(layerName)) {
                layer = this.__layers[layerName];
                sum += layer.data[affectedVertexInfo.id];
            }
        }

        //keep this.__displacements in sync
        this.__displacements[affectedVertexInfo.id] = sum;

        //TODO: push towards normal instead of just y
        var vertex = geom.vertices[affectedVertexInfo.id];
        vertex.y = sum;
    }

    //update terrain geometry
    geom.verticesNeedUpdate = true;
    geom.computeFaceNormals();
    geom.computeVertexNormals();
    geom.normalsNeedUpdate = true;
};
SkulptTerrainMesh.prototype.updateAll = function () {

    var geom = this.__mesh.geometry;

    var i, len;
    for (i = 0, len = geom.vertices.length; i < len; i++) {

        //sum all layers
        var layer, layerName;
        var sum = 0;
        for (layerName in this.__layers) {
            if (this.__layers.hasOwnProperty(layerName)) {
                layer = this.__layers[layerName];
                sum += layer.data[i];
            }
        }

        //keep this.__displacements in sync
        this.__displacements[i] = sum;

        //TODO: push towards normal instead of just y
        var vertex = geom.vertices[i];
        vertex.y = sum;
    }

    //update terrain geometry
    geom.verticesNeedUpdate = true;
    geom.computeFaceNormals();
    geom.computeVertexNormals();
    geom.normalsNeedUpdate = true;
};

//===================================
// SKULPT CURSORS
//===================================

/**
 * Abstract class for cursors
 * @constructor
 * @param {number} size
 * @param {number} amount
 */
function SkulptCursor(size, amount) {
    this.__size = size || 1.0;
    this.__amount = amount || 1.0;
}
SkulptCursor.prototype.getSize = function () {
    return this.__size;
};
SkulptCursor.prototype.setSize = function (size) {
    this.__size = size;
};
SkulptCursor.prototype.getAmount = function () {
    return this.__amount;
};
SkulptCursor.prototype.setAmount = function (amount) {
    this.__amount = amount;
};
SkulptCursor.prototype.show = function () {
    throw new Error('Abstract method not implemented');
};
SkulptCursor.prototype.hide = function () {
    throw new Error('Abstract method not implemented');
};
SkulptCursor.prototype.update = function (x, y, z, geom) {
    throw new Error('Abstract method not implemented');
};

/**
 * Brush cursor that is created from a THREE.Mesh
 * @constructor
 * @extends {SkulptCursor}
 * @param {number} size
 * @param {number} amount
 * @param {THREE.Scene} scene
 * @param {number} radiusSegments
 */
function SkulptMeshCursor(size, amount, scene, radiusSegments) {

    SkulptCursor.call(this, size, amount);

    if (!scene) {
        throw new Error('scene not specified');
    }
    this.__scene = scene;
    this.__radiusSegments = radiusSegments || 32;

    //create the cursor mesh
    this.__createMesh();

    //hide the mesh by default
    this.hide();
}
SkulptMeshCursor.prototype = Object.create(SkulptCursor.prototype);
SkulptMeshCursor.prototype.constructor = SkulptMeshCursor;
SkulptMeshCursor.prototype.__createMesh = function () {

    this.__cursorGeom = new THREE.CylinderGeometry(0.5, 0.5, 1, this.__radiusSegments, 1, true);
    this.__brushGeomVertexCountHalf = this.__cursorGeom.vertices.length / 2.0;
    var brushMaterial = new THREE.MeshBasicMaterial({color: '#000000'});
    brushMaterial.wireframe = true;
    this.__cursorMesh = new THREE.Mesh(this.__cursorGeom, brushMaterial);
    this.__cursorMesh.castShadow = false;
    this.__cursorMesh.receiveShadow = false;

    this.__cursorMesh.add(new THREE.AxisHelper(1));

    this.__scene.add(this.__cursorMesh);
};
SkulptCursor.prototype.setSize = function (size) {
    this.__size = size;
    this.__cursorMesh.scale.x = size;
    this.__cursorMesh.scale.z = size;
};
SkulptCursor.prototype.setAmount = function (amount) {
    this.__amount = amount;
    this.__cursorMesh.scale.y = amount;
};
SkulptMeshCursor.prototype.show = function () {
    this.__cursorMesh.visible = true;
};
SkulptMeshCursor.prototype.hide = function () {
    this.__cursorMesh.visible = false;
};
SkulptMeshCursor.prototype.update = function (x, y, z, geom) {

    //TODO: check if arguments are really needed or not

    //move cursor to position
    this.__cursorMesh.position.set(x, y, z);

    //NOTE: Below algo works when using this.__cursorMesh.position but not this.__cursorMesh.matrixWorld. The former is better anyway because there's no need to find matrix inverse.
    //var brushMeshMatrixWorldInverse = new THREE.Matrix4().getInverse(this.__cursorMesh.matrixWorld);
    var i;
    var len = this.__cursorGeom.vertices.length;
    for (i = 0; i < len; i++) {

        //get position of this brush geom vertex
        var brushGeomVertex = this.__cursorGeom.vertices[i];

        //get world space position (by adding position as offset)
        var brushGeomVertexWorld = brushGeomVertex.clone();
        //brushGeomVertexWorld.applyMatrix4(this.__cursorMesh.matrixWorld);
        brushGeomVertexWorld.setX(brushGeomVertexWorld.x * this.__cursorMesh.scale.x);
        brushGeomVertexWorld.setZ(brushGeomVertexWorld.z * this.__cursorMesh.scale.z);
        brushGeomVertexWorld.add(this.__cursorMesh.position);

        //get nearest terrain geom vertex id
        //TODO: calcTerrainVertexId function
        var terrainVertexId = calcTerrainVertexId(brushGeomVertexWorld.x, brushGeomVertexWorld.z);

        //get y in brush geom's local space
        var brushGeomVertexLocal;
        if (geom.vertices[terrainVertexId]) {
            brushGeomVertexLocal = geom.vertices[terrainVertexId].clone();
        } else {
            //have to use brush vertex if unable to index into terrain vertex
            brushGeomVertexLocal = brushGeomVertexWorld;
        }
        //brushGeomVertexLocal.applyMatrix4(brushMeshMatrixWorldInverse);
        brushGeomVertexLocal.sub(this.__cursorMesh.position);
        brushGeomVertexWorld.setX(brushGeomVertexWorld.x / this.__cursorMesh.scale.x);
        brushGeomVertexWorld.setZ(brushGeomVertexWorld.z / this.__cursorMesh.scale.z);

        //finally write brush geom vertex y in local space
        brushGeomVertex.y = brushGeomVertexLocal.y;
    }

    //offset top row using sculpt amount to give thickness
    for (i = 0; i < this.__brushGeomVertexCountHalf; i++) {
        this.__cursorGeom.vertices[i].y = this.__cursorGeom.vertices[i + this.__brushGeomVertexCountHalf].y + this.__amount;
    }

    //update cursor geom
    this.__cursorGeom.verticesNeedUpdate = true;
};

//===================================
// SKULPT PROFILES
//===================================

/**
 * Abstract class for sculpt profiles
 * @constructor
 */
function SkulptProfile() { }
/**
 * Returns a value based on given <tt>weight</tt>
 * @abstract
 * @param  {number} weight - a 0 - 1 float number that determines the returned value
 * @return {number}
 */
SkulptProfile.prototype.getValue = function (weight) {
    throw new Error('Abstract method not implemented');
};

/**
 * Sculpt profile that is based on a cosine curve
 * @constructor
 * @extends {SkulptProfile}
 */
function CosineSkulptProfile() {
    SkulptProfile.call(this);
    this.__halfPi = Math.PI / 2.0;
}
CosineSkulptProfile.prototype = Object.create(SkulptProfile.prototype);
CosineSkulptProfile.prototype.constructor = CosineSkulptProfile;
CosineSkulptProfile.prototype.getValue = function (weight) {
    return Math.cos(weight * this.__halfPi);
};

/**
 * Sculpt profile that is based on constant value of 1
 * @constructor
 * @extends {SkulptProfile}
 */
function ConstantSkulptProfile() {
    SkulptProfile.call(this);
}
ConstantSkulptProfile.prototype = Object.create(SkulptProfile.prototype);
ConstantSkulptProfile.prototype.constructor = ConstantSkulptProfile;
ConstantSkulptProfile.prototype.getValue = function (weight) {
    return 1;
};

//===================================
// SKULPT BRUSHES
//===================================

/**
 * Abstract class for sculpt brushes
 * @constructor
 * @param {number} size
 */
function SkulptBrush(size, amount, scene) {
    this.__cursor = new SkulptMeshCursor(size, amount, scene);
}
/**
 * Performs sculpting
 * @abstract
 */
SkulptBrush.prototype.sculpt = function (mesh, position, profile) {
    throw new Error('Abstract method not implemented');
};
SkulptBrush.prototype.getSize = function (size) {
    return this.__cursor.getSize();
};
SkulptBrush.prototype.setSize = function (size) {
    this.__cursor.setSize(size);
};
SkulptBrush.prototype.getAmount = function (amount) {
    return this.__cursor.getAmount();
};
SkulptBrush.prototype.setAmount = function (amount) {
    this.__cursor.setAmount(amount);
};
SkulptBrush.prototype.showCursor = function () {
    this.__cursor.show();
};
SkulptBrush.prototype.hideCursor = function () {
    this.__cursor.hide();
};
SkulptBrush.prototype.updateCursor = function (x, y, z, geom) {
    this.__cursor.update(x, y, z, geom);
};

/**
 * Sculpt brush that adds to a mesh
 * @constructor
 * @extends {SkulptBrush}
 * @param {number} size
 */
function SkulptAddBrush(size, amount, scene) {
    SkulptBrush.call(this, size, amount, scene);
}
SkulptAddBrush.prototype = Object.create(SkulptBrush.prototype);
SkulptAddBrush.prototype.constructor = SkulptAddBrush;
/**
 * Performs sculpting
 * @override
 */
SkulptAddBrush.prototype.sculpt = function (mesh, position, profile) {

    var layer = mesh.getCurrLayer();
    var radius = this.getSize() / 2.0;
    var amount = this.getAmount();
    var affectedVertexInfos = mesh.getAffectedVertexInfo(position, radius);
    var vertexInfo;
    var i, len;
    for (i = 0, len = affectedVertexInfos.length; i < len; i++) {
        vertexInfo = affectedVertexInfos[i];
        layer.data[vertexInfo.id] += amount * profile.getValue(vertexInfo.weight);
    }

    //update the mesh at the affected vertices
    mesh.update(affectedVertexInfos);
};

/**
 * Sculpt brush that removes from a mesh
 * @constructor
 * @extends {SkulptBrush}
 * @param {number} size
 */
function SkulptRemoveBrush(size, amount, scene) {
    SkulptBrush.call(this, size, amount, scene);
}
SkulptRemoveBrush.prototype = Object.create(SkulptBrush.prototype);
SkulptRemoveBrush.prototype.constructor = SkulptRemoveBrush;
/**
 * Performs sculpting
 * @override
 */
SkulptRemoveBrush.prototype.sculpt = function (mesh, position, profile) {

    var layer = mesh.getCurrLayer();
    var radius = this.getSize() / 2.0;
    var amount = this.getAmount();
    var affectedVertexInfos = mesh.getAffectedVertexInfo(position, radius);
    var vertexInfo;
    var i, len;
    for (i = 0, len = affectedVertexInfos.length; i < len; i++) {
        vertexInfo = affectedVertexInfos[i];
        layer.data[vertexInfo.id] -= amount * profile.getValue(vertexInfo.weight);
    }

    //update the mesh at the affected vertices
    mesh.update(affectedVertexInfos);
};

/**
 * Sculpt brush that flattens a mesh
 * @constructor
 * @extends {SkulptBrush}
 * @param {number} size
 */
function SkulptFlattenBrush(size, amount, scene) {
    SkulptBrush.call(this, size, amount, scene);
}
SkulptFlattenBrush.prototype = Object.create(SkulptBrush.prototype);
SkulptFlattenBrush.prototype.constructor = SkulptFlattenBrush;
/**
 * Performs sculpting
 * @override
 */
SkulptFlattenBrush.prototype.sculpt = function (mesh, position, profile) {

    var layer = mesh.getCurrLayer();
    var radius = this.getSize() / 2.0;
    // var amount = this.getAmount();  //TODO: flatten don't need amount?
    var affectedVertexInfos = mesh.getAffectedVertexInfo(position, radius);
    var displacements = mesh.getDisplacements();

    //calculate average displacements
    var totalAffectedDisplacements = 0;
    var vertexInfo;
    var i, len;
    for (i = 0, len = affectedVertexInfos.length; i < len; i++) {
        vertexInfo = affectedVertexInfos[i];
        totalAffectedDisplacements += displacements[vertexInfo.id];
    }
    var averageDisp = totalAffectedDisplacements / affectedVertexInfos.length;

    //blend average displacement with existing displacement to flatten
    var modulator, currDisplacement;
    for (i = 0, len = affectedVertexInfos.length; i < len; i++) {
        vertexInfo = affectedVertexInfos[i];
        modulator = profile.getValue(vertexInfo.weight);
        currDisplacement = displacements[vertexInfo.id];
        layer.data[vertexInfo.id] = modulator * averageDisp + (1 - modulator) * currDisplacement;
    }

    //update the mesh at the affected vertices
    mesh.update(affectedVertexInfos);
};

//===================================
// SKULPT
//===================================

/**
 * Creates a Skulpt instance that manages sculpting
 * @constructor
 * @param {THREE.Scene} scene - main scene to add meshes
 */
function Skulpt(scene) {
    if (!scene) {
        throw new Error('scene not specified');
    }
    this.__scene = scene;

    this.__meshes = {};
    this.__currMesh = undefined;  //defined when intersection test is done
    this.__brushes = {
        'add': new SkulptAddBrush(1.0, 1.0, scene),
        'remove': new SkulptRemoveBrush(1.0, 1.0, scene),
        'flatten': new SkulptFlattenBrush(1.0, 1.0, scene)
    };  //TODO: probably should be managed by a singleton
    this.__currBrush = this.__brushes[Object.keys(this.__brushes)[0]];
    this.__currProfile = new CosineSkulptProfile(); //TODO: methods for profile, probably should be managed by a singleton
    this.__cursor = new SkulptCursor(scene);
}
/**
 * Adds a mesh with name <tt>name</tt>
 * @param  {SkulptMesh} skulptMesh
 * @param  {string} name
 */
Skulpt.prototype.addMesh = function (skulptMesh, name) {
    if (!(skulptMesh instanceof SkulptMesh)) {
        throw new Error('skulptMesh must be of type SkulptMesh');
    }
    if (Object.keys(this.__meshes).indexOf(name) !== -1) {
        throw new Error('Skulpt mesh name already exists: ' + name);
    }
    this.__meshes[name] = skulptMesh;
    this.__currMesh = skulptMesh;
};
Skulpt.prototype.getMesh = function (name) {
    if (Object.keys(this.__meshes).indexOf(name) === -1) {
        throw new Error('Skulpt mesh name does not exist: ' + name);
    }
    return this.__meshes[name];
};
/**
 * Removes mesh with name <tt>name</tt>
 * @param  {string} name
 */
Skulpt.prototype.removeMesh = function (name) {
    if (Object.keys(this.__meshes).indexOf(name) === -1) {
        throw new Error('Skulpt mesh name does not exist: ' + name);
    }
    delete this.__meshes[name];  //TODO: check this
};
/**
 * Set current brush to brush with name <tt>name</tt>
 * @param {string} name
 */
Skulpt.prototype.setBrush = function (name) {
    if (Object.keys(this.__brushes).indexOf(name) === -1) {
        throw new Error('Brush name not recognised: ' + name);
    }
    this.__currBrush = this.__brushes[name];
};
Skulpt.prototype.getBrushSize = function () {
    return this.__currBrush.getSize();
};
Skulpt.prototype.setBrushSize = function (size) {
    //TODO: let the singleton manager do this
    var brushId;
    for (brushId in this.__brushes) {
        if (this.__brushes.hasOwnProperty(brushId)) {
            var brush = this.__brushes[brushId];
            brush.setSize(size);
        }
    }
};
Skulpt.prototype.getBrushAmount = function () {
    return this.__currBrush.getAmount();
};
Skulpt.prototype.setBrushAmount = function (amount) {
    //TODO: let the singleton manager do this
    var brushId;
    for (brushId in this.__brushes) {
        if (this.__brushes.hasOwnProperty(brushId)) {
            var brush = this.__brushes[brushId];
            brush.setAmount(amount);
        }
    }
};
Skulpt.prototype.updateCursor = function (x, y, z, geom) {
    this.__currBrush.updateCursor(x, y, z, geom);
};
Skulpt.prototype.showCursor = function () {
    this.__currBrush.showCursor();
};
Skulpt.prototype.hideCursor = function () {
    this.__currBrush.hideCursor();
};
/**
 * Sculpts at <tt>position</tt> on the current mesh
 * @param {THREE.Vector3} position - position to sculpt at
 */
Skulpt.prototype.sculpt = function (position) {
    this.__currBrush.sculpt(this.__currMesh, position, this.__currProfile);
};
// Skulpt.prototype.export = function()
// {

// }
// Skulpt.prototype.import = function()
// {

// }
