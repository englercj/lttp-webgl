define([
    //Modules
    'game/lib/core/Viewport',
    'game/lib/core/Controls',
    'game/lib/core/TileMap',
    'game/lib/core/Player',
    'game/lib/core/UI',
    //data
    'game/data/data'
    //Scritps that modify global
    //'game/lib/core/three_fpcontrols'
], function(Viewport, Controls, TileMap, Player, UI, data) {
    var Engine = Class.extend({
        init: function(elements) {
            var self = this;
            this.debug = true;

            if(this.debug) window.engine = this;

            //setup game
            this.entities = [];
            this.ui = new UI(elements, this);
            this.scene = new THREE.Scene();
            this.clock = new THREE.Clock(false);
            this.renderer = new THREE.WebGLRenderer();
            this.viewport = new Viewport(elements.container, this);

            this.paused = false;
            this.started = false;

            //show mudora text
            /*this.ui.showDialog([
                '`~`^`~`^`^`',
                '`^`~`~`^`~',
                '`^`~`~`^`~`'
            ]);*/

            //camera setup
            var width = this.viewport.width, height = this.viewport.height;
            this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);//new THREE.PerspectiveCamera(60, this.viewport.aspect(), 1, 10000);
            this.camera.position.z = 250;
            this.scene.add(this.camera);
            this.viewport.setCamera(this.camera);

            //map setup
            this.map = new TileMap(data.maps.LIGHTWORLD, this);//resources.maps.lightworld, this.viewport);
            this.map.addToScene(this.scene);

            //controls setup
            this.controls = new Controls(this.viewport, this.camera, this.map);//new THREE.FirstPersonControls(this.camera);
            this.controls.lockCamera.x = this.controls.lockCamera.y = true;

            this.controls.on('pause', function() {
                self.togglePause();
            });

            //setup player
            this.player = new Player(data.entities.PLAYER, this);
            this.player.addToScene(this.scene);

            //setup UI
            this.ui.setControls(this.controls);

            //create entities (enemies, items, bushes, etc)
            //this.entities.push(link);

            //add ambient light
            this.scene.add(new THREE.AmbientLight(0xFFFFFF));

            //load initial zone
            this.loadZone(data.maps.LIGHTWORLD.zone);

            this.stats = new Stats();
            this.stats.domElement.style.position = 'absolute';
            this.stats.domElement.style.top = '0px';
            
            $('body').append(this.stats.domElement);
        },
        start: function() {
            if(this.started && !this.paused) return;

            this.ui.hidePaused();
            this.paused = false;
            this.started = true;
            this.clock.start();
            this._tick();
        },
        pause: function() {
            if(this.paused) return;

            this.ui.showPaused();
            this.paused = true;
            this.clock.stop();
        },
        togglePause: function() {
            if(this.paused)
                this.start();
            else
                this.pause();
        },
        destroyMesh: function(mesh) {
            this.scene.remove(mesh);
            this.renderer.deallocateObject(mesh);
        },
        destroyTexture: function(tex) {
            this.renderer.deallocateTexture(tex);
        },
        destroyEntity: function(ent) {
            this.destroyMesh(ent._mesh);

            if(ent.texture)
                this.destroyTexture(ent.texture);
        },
        //loads and places all the entities in a zone
        loadZone: function(zone) {
            var newZone = this.map.zones[this.map.findZoneIndex(zone)];

            this.map.loadZone(zone);

            //spawn entities
            //for (var i = 0m il = newZone.entities.length; i < il; ++i) {
                //newZone.entities[i]
            //};

            //TODO: animation of zoning hero (probably in Player by freezing the hero, and moving the camera)
        },
        //cleans up all the entities in a zone
        unloadZone: function(zone) {
            for(var i = 0, il = this.entities.length; i < il; ++i) {
                this.destryEntity(this.entities[i]);
            }
        },
        //TODO: More intelligent redraw, some expensive calls (such as .render() and entity updates)
        //don't need to be called every tick
        _tick: function() {
            //proxy the call so we retain the context
            if(!this.paused) requestAnimationFrame($.proxy(this._tick, this));

            //useful for throttling framerate for testing
            //0 = show all frames, 1 = half frames, 2 = 1/3 frames, 3 = 1/4 frames, etc...
            if(this.throttle) { this.throttle--; return; }
            this.throttle = 0;
            
            var delta = this.clock.getDelta();
            
            //update stats box
            this.stats.update();
            
            //update controls
            this.controls.update(delta);

            //update player entity
            this.player.update(delta);

            //update other entities
            for(var i = 0, il = this.entities.length; i < il; ++i) {
                if(this.entities[i] && this.entities[i].update)
                    this.entities[i].update(delta);
            }
            
            //update UI
            //TODO: this should only update when dirty, not all the time
            this.ui.update(delta);
            
            //render scene
            this.renderer.render(this.scene, this.camera);
        }
    });

    return Engine;
});