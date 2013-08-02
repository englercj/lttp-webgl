var ATTACK_CONE = 0.4,
    ATTACK_SENSOR_RADIUS = 18,
    USE_CONE = 0.3,
    THROW_DISTANCE = 50;

define([
    'game/data/types',
    'game/entities/Entity',
    'game/entities/misc/Smash'
], function(types, Entity, Smash) {
    var Link = function(spritesheet) {
        Entity.call(this, spritesheet);

        //player type
        this.type = types.ENTITY.PLAYER;

        //set name of Link
        this.name = 'link';

        //maximum maxMagic of this entity
        this.maxMagic = 10;

        //current magic of this entity
        this.magic = 10;

        //current inventory of the entity
        this.inventory = {};

        //objects currently within attack range
        this.inAttackRange = [];
        this.colliding = [];

        //a pool of sprite to do smashing animations
        this.smashPool = new gf.ObjectPool(Smash, lttp.game);

        //size
        //this.width = 16;
        //this.height = 22;

        this.movement = new gf.Vector();
        this.actions = {
            move: {},
            attack: false,
            holdAttack: false
        };

        this.bindKeys();
        this.bindGamepad();
        this.addAnimations();

        this.anchor.x = this.anchor.y = 0.5;

        this.on('physUpdate', this._physUpdate.bind(this));

        //make the camera track this entity
        window.link = this;
    };

    gf.inherits(Link, Entity, {
        bindKeys: function() {
            //bind the keyboard
            lttp.game.input.keyboard.on(gf.input.KEY.W, this.onWalk.bind(this, 'up'));
            lttp.game.input.keyboard.on(gf.input.KEY.S, this.onWalk.bind(this, 'down'));
            lttp.game.input.keyboard.on(gf.input.KEY.A, this.onWalk.bind(this, 'left'));
            lttp.game.input.keyboard.on(gf.input.KEY.D, this.onWalk.bind(this, 'right'));

            lttp.game.input.keyboard.on(gf.input.KEY.E, this.onUse.bind(this));
            lttp.game.input.keyboard.on(gf.input.KEY.SPACE, this.onAttack.bind(this));
        },
        bindGamepad: function() {
            //bind the gamepad
            lttp.game.input.gamepad.sticks.on(gf.input.GP_AXIS.LEFT_ANALOGUE_HOR, this.onGpWalk.bind(this));
            lttp.game.input.gamepad.sticks.on(gf.input.GP_AXIS.LEFT_ANALOGUE_VERT, this.onGpWalk.bind(this));
            lttp.game.input.gamepad.sticks.threshold = 0.35;

            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.PAD_TOP, this.onWalk.bind(this, 'up'));
            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.PAD_BOTTOM, this.onWalk.bind(this, 'down'));
            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.PAD_LEFT, this.onWalk.bind(this, 'left'));
            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.PAD_RIGHT, this.onWalk.bind(this, 'right'));

            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.FACE_1, this.onUse.bind(this));
            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.FACE_2, this.onAttack.bind(this));
            lttp.game.input.gamepad.buttons.on(gf.input.GP_BUTTON.FACE_4, this.onUseItem.bind(this));
        },
        addAnimations: function() {
            //add walking animations
            this._addDirectionalFrames('walk', 8, 0.4, true);

            //add idle shield animations
            this.addAnimation('idle_shield_left', [this.spritesheet['walk_shield_left/walk_shield_left_1.png'].frames[0]]);
            this.addAnimation('idle_shield_right', [this.spritesheet['walk_shield_right/walk_shield_right_1.png'].frames[0]]);
            this.addAnimation('idle_shield_down', [this.spritesheet['walk_shield_down/walk_shield_down_1.png'].frames[0]]);
            this.addAnimation('idle_shield_up', [this.spritesheet['walk_shield_up/walk_shield_up_1.png'].frames[0]]);

            this.addAnimation('idle_left', [this.spritesheet['walk_left/walk_left_1.png'].frames[0]]);
            this.addAnimation('idle_right', [this.spritesheet['walk_right/walk_right_1.png'].frames[0]]);
            this.addAnimation('idle_down', [this.spritesheet['walk_down/walk_down_1.png'].frames[0]]);
            this.addAnimation('idle_up', [this.spritesheet['walk_up/walk_up_1.png'].frames[0]]);

            //add attack animations
            this._addDirectionalFrames('attack', 9, 0.6);

            //add bow attack animations
            this._addDirectionalFrames('attack_bow', 3, 0.23);

            //add spin attack animations
            this._addDirectionalFrames('attack_spin', 12, 0.23);

            //add attack tap animations
            this._addDirectionalFrames('attack_tap', 3, 0.23);

            //add fall in hole animations
            this._addFrames('fall_in_hole', 4, 0.23);

            //add lifting animations
            this._addDirectionalFrames('lift', 4, 0.23);

            //add lifting walking animations
            this._addFrames(['lift_walk_left', 'lift_walk_right'], 3, 0.23);
            this._addFrames(['lift_walk_down', 'lift_walk_up'], 6, 0.23);

            //add pulling animations
            this._addDirectionalFrames('pull', 5, 0.23);

            //add walking-attacking animations
            this._addFrames(['walk_attack_left', 'walk_attack_right'], 3, 0.23, true);
            this._addFrames(['walk_attack_down', 'walk_attack_up'], 6, 0.23, true);

            //add walking with shield animations
            this._addDirectionalFrames('walk_shield', 8, 0.23, true);

            //set active
            this.gotoAndStop('idle_down');
            this.lastDir = 'down';
        },
        onWalk: function(dir, e) {
            if(e.originalEvent)
                e.input.preventDefault(e.originalEvent);

            // .down is keypressed down
            if(e.down) {
                if(this.actions.move[dir]) return; //skip repeats (holding a key down)

                this.actions.move[dir] = true;
            } else {
                this.actions.move[dir] = false;
            }

            this._checkMovement();
        },
        onGpWalk: function(e) {
            var dir;
            if(e.code === gf.input.GP_AXIS.LEFT_ANALOGUE_HOR) {
                if(e.value === 0) {
                    if(!this._lastHorzGpValue)
                        return;

                    this.actions.move.left = false;
                    this.actions.move.right = false;
                } else if(e.value > 0) {
                    if(this.actions.move.right)
                        return;

                    this.actions.move.right = true;
                } else {
                    if(this.actions.move.left)
                        return;

                    this.actions.move.left = true;
                }
                this._lastHorzGpValue = e.value;
            }
            else {
                if(e.value === 0) {
                    if(!this._lastVertGpValue)
                        return;

                    this.actions.move.down = false;
                    this.actions.move.up = false;
                } else if(e.value > 0) {
                    if(this.actions.move.down)
                        return;

                    this.actions.move.down = true;
                } else {
                    if(this.actions.move.up)
                        return;

                    this.actions.move.up = true;
                }
                this._lastVertGpValue = e.value;
            }

            this._checkMovement();
        },
        //when attack key is pressed
        onAttack: function(e) {
            if(e.originalEvent)
                e.input.preventDefault(e.originalEvent);

            if(e.down) {
                if(this.locked || this.actions.holdAttack)
                    return;

                this.lock();
                this.actions.attack = true;
                this.actions.holdAttack = true;
                this._setAttackAnimation();
                this._checkAttack();
            } else {
                this.actions.holdAttack = false;
            }
        },
        lock: function() {
            this.setVelocity([0, 0]);
            this.locked = true;
        },
        unlock: function() {
            this._setMoveAnimation();
            this.setVelocity(this.movement);
            this.locked = false;
        },
        addAttackSensor: function(phys) {
            if(this.atkSensor) return;

            this.atkSensor = phys.addCustomShape(this, new gf.Circle(0, 0, ATTACK_SENSOR_RADIUS), true);
        },
        //Talk, run, Lift/Throw/Push/Pull
        onUse: function(status) {
            if(!status.down || this.locked)
                return;

            //throws
            if(this.carrying) {
                var item = this.carrying,
                    v = this._getDirVector(),
                    self = this;

                this.carrying = null;

                TweenLite.to(item.position, 0.25, {
                    x: '+=' + (THROW_DISTANCE * v.x),
                    y: '+=' + ((THROW_DISTANCE * v.y) + ((v.y^1) * (this.height / 2))),
                    ease: Linear.easeNone,
                    onCompleteParams: [item],
                    onComplete: function(obj) {
                        self._destroyObject(obj);
                    }
                })

                return;
            }

            for(var i = 0; i < this.colliding.length; ++i) {
                var e = this.colliding[i],
                    t;

                if(!e.properties)
                    continue;

                t = e.properties.type;

                if(t !== 'grass' && t !== 'rock' && t !== 'sign')
                    continue;

                if(this._inCone(e, USE_CONE)) {
                    this.lock();

                    //change physics to sensor
                    e.disablePhysics();
                    e.sensor = true;
                    e.enablePhysics();

                    //make it on top
                    e.parent.removeChild(e);
                    lttp.game.world.addChild(e);
                    //do link animation

                    var self = this;
                    TweenLite.to(e.position, 0.25, {
                        x: this.position.x,
                        y: this.position.y - this.height,
                        ease: Linear.easeNone,
                        onCompleteParams: [e],
                        onComplete: function(obj) {
                            //set that we are carrying it
                            self.carrying = obj;
                            self.unlock();
                        }
                    });

                    break;
                }
            }
        },
        //Uses the currently equipted item
        onUseItem: function() {

        },
        _destroyObject: function(o) {
            var t = o.properties.type,
                spr = this.smashPool.create();

            spr.gotoAndPlay(t);
            spr.visible = true;
            spr.anchor.x = o.anchor.x;
            spr.anchor.y = o.anchor.y;
            spr.setPosition(o.position.x, o.position.y);

            //TODO: drops?
            o.destroy();
        },
        _physUpdate: function() {
            if(this.carrying) {
                this.carrying.position.x = this.position.x;
                this.carrying.position.y = this.position.y - this.height;
            }
        },
        _checkAttack: function() {
            for(var i = this.inAttackRange.length - 1; i > -1; --i) {
                var e = this.inAttackRange[i],
                    t = e.properties.type;

                if(t.indexOf('grass') === -1)
                    continue;

                if(this._inCone(e, ATTACK_CONE)) {
                    if(e.takeDamage) {
                        e.takeDamage(this.damage)
                    } else if(t.indexOf('grass') !== -1) {
                        this._destroyObject();
                    }
                }
            }
        },
        _inCone: function(obj, cone) {
            var vec = new gf.Vector(
                obj.position.x - this.position.x,
                obj.position.y - this.position.y
            );

            vec.normalize();

            //check if 'e' is withing a conic area in the direction we face
            switch(this.lastDir) {
                case 'left':
                    return (vec.x < 0 && vec.y > -cone && vec.y < cone);
                case 'right':
                    return (vec.x > 0 && vec.y > -cone && vec.y < cone);
                case 'up':
                    return (vec.y < 0 && vec.x > -cone && vec.x < cone);
                case 'down':
                    return (vec.y > 0 && vec.x > -cone && vec.x < cone);
            }
        },
        _getDirVector: function() {
            //check if 'e' is withing a conic area in the direction we face
            switch(this.lastDir) {
                case 'left':
                    return new gf.Vector(-1, 0);
                case 'right':
                    return new gf.Vector(1, 0);
                case 'up':
                    return new gf.Vector(0, -1);
                case 'down':
                    return new gf.Vector(0, 1);
            }
        },
        _checkMovement: function() {
            //doing this in an action status based way means that pressing two opposing
            //keys at once and release one will still work (like pressing left & right, then releasing right)
            if(this.actions.move.left && this.actions.move.right)
                this.movement.x = 0;
            else if(this.actions.move.left)
                this.movement.x = -this.moveSpeed;
            else if(this.actions.move.right)
                this.movement.x = this.moveSpeed;
            else
                this.movement.x = 0;

            if(this.actions.move.up && this.actions.move.down)
                this.movement.y = 0;
            else if(this.actions.move.up)
                this.movement.y = -this.moveSpeed;
            else if(this.actions.move.down)
                this.movement.y = this.moveSpeed;
            else
                this.movement.y = 0;

            if(this.locked) return;

            this._setMoveAnimation();
            this.setVelocity(this.movement);
        },
        _setMoveAnimation: function() {
            var anim = (this.movement.x || this.movement.y) ? 'walk' : 'idle';

            if(this.inventory.shield) {
                this._setMoveDirAnimation(anim + '_shield');
            }
            else {
                this._setMoveDirAnimation(anim);
            }
        },
        _setMoveDirAnimation: function(anim) {
            if(this.movement.x) {
                if(this.movement.x > 0) {
                    this.lastDir = 'right';
                    this.gotoAndPlay(anim + '_right');
                } else {
                    this.lastDir = 'left';
                    this.gotoAndPlay(anim + '_left');
                }
            }
            else if(this.movement.y) {
                if(this.movement.y > 0) {
                    this.lastDir = 'down';
                    this.gotoAndPlay(anim + '_down'); 
                } else {
                    this.lastDir = 'up';
                    this.gotoAndPlay(anim + '_up');
                }
            }
            else {
                this.gotoAndStop(anim + '_' + this.lastDir);
            }
        },
        _setAttackAnimation: function() {
            if(!this._attackAnchorMap) {
                this._attackAnchorMap = {
                    up: {
                        0: [0, 1],
                        1: [-0.05, 1],
                        2: [0.05, 1],
                        3: [0, 1],
                        6: [0.2, 1],
                        7: [0.3, 1],
                        8: [0.4, 1]
                    },
                    down: {
                        0: [0.2, 1],
                        2: [0.2, 0.95],
                        3: [0.2, 0.79],
                        4: [0.1, 0.75],
                        5: [0.1, 0.75],
                        6: [0.1, 0.75],
                        7: [0.1, 0.75],
                        8: [0.1, 0.8],
                        9: [0.1, 0.75]
                    },
                    right: {
                        0: [0, 1],
                        7: [0, 0.75],
                        8: [0, 0.7]
                    },
                    left: {
                        0: [0.5, 1],
                        7: [0.5, 0.8]
                    }
                }
            }

            var ax = this.anchor.x,
                ay = this.anchor.y,
                dir = this.lastDir,
                mp = this._attackAnchorMap[dir],
                self = this,
                frame = function(anim, fr) {
                    if(mp && mp[fr]) {
                        self.anchor.x = mp[fr][0];
                        self.anchor.y = mp[fr][1];
                    }
                };

            this.on('frame', frame);
            this.once('complete', function() {
                self.anchor.x = ax;
                self.anchor.y = ay;
                self.actions.attack = false;
                self.off('frame', frame);
                self.unlock();
            });
            this.gotoAndPlay('attack_' + dir);
        },
        //on collision
        _collide: function(obj, vec, colShape, myShape) {
            //we got into range of something to attack
            if(myShape === this.atkSensor) {
                if(obj.type === types.ENTITY.ENEMY || !obj.type) {
                    this.inAttackRange.push(obj);

                    //something new walked in while we were attacking
                    if(this.actions.attack)
                        this._checkAttack();
                }
            }
            //colliding with a new zone
            else if(obj.type === 'zone') {
                lttp.loadZone(obj, vec);
            }
            //collide with an exit
            else if(obj.type === 'exit') {
                lttp.loadWorld(obj, vec);
            } else {
                this.colliding.push(obj);
            }
        },
        _separate: function(obj, colShape, myShape) {
            if(myShape === this.atkSensor) {
                var i = this.inAttackRange.indexOf(obj);

                if(i >= 0) {
                    this.inAttackRange.splice(i, 1);
                }
            } else {
                var i = this.colliding.indexOf(obj);

                if(i >= 0) {
                    this.colliding.splice(i, 1);
                }
            }
        }
    });

    return Link;
});