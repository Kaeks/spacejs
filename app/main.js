(function(canvas, context) {

	Array.prototype.clean = function(deleteValue) {
		for (let i = 0; i < this.length; i++) {
			if (this[i] === deleteValue) {
				this.splice(i, 1);
				i--;
			}
		}
		return this;
	};

	let appObjectList = [];

	class Path {
		steps = [];
		origSteps = [];
		centerX = 0;
		centerY = 0;

		fillColor;
		strokeColor;

		rotation = 0;
		scale = 1;

		constructor(steps) {
			this.steps = steps ? steps : [];
			this.origSteps = JSON.parse(JSON.stringify(this.steps));
		}

		setRotation(newVal) {
			while (newVal > 360) newVal -= 360;
			while (newVal < 0) newVal += 360;
			this.rotation = newVal;
		}

		setScale(newVal) {
			this.scale = newVal;
		}

		applyVariables() {
			for (let i = 0; i < this.steps.length; i++) {
				let origStep = this.origSteps[i], origValues = origStep.values, origX = origValues[0], origY = origValues[1],
					radians = (Math.PI / 180) * this.rotation, sin = Math.sin(radians), cos = Math.cos(radians);

				this.steps[i].values[0] = this.scale * ((cos * (origX + this.centerX)) + (sin * (origY + this.centerY)));
				this.steps[i].values[1] = this.scale * ((cos * (origY + this.centerY)) - (sin * (origX + this.centerX)));
			}
		}

		setPermanentRotation(newVal) {
			for (let i = 0; i < this.origSteps.length; i++) {
				let origStep = this.origSteps[i], origValues = origStep.values, origX = origValues[0], origY = origValues[1],
					radians = (Math.PI / 180) * newVal, sin = Math.sin(radians), cos = Math.cos(radians);

				this.origSteps[i].values[0] = (cos * (origX + this.centerX)) + (sin * (origY + this.centerY));
				this.origSteps[i].values[1] = (cos * (origY + this.centerY)) - (sin * (origX + this.centerX));
			}
		}

		rotate(deg) {
			this.setRotation(this.rotation += deg)
		}

		shift(x, y) {
			for (let i = 0; i < this.steps.length; i++) {
				let step = this.steps[i];
				let values = step.values;
				values[0] += x;
				values[1] += y;
				this.centerX = x;
				this.centerY = y;
			}
		}

		execute() {
			this.applyVariables();
			for (let i = 0; i < this.steps.length; i++) {
				let step = this.steps[i];
				let values = step.values;
				switch (step.type) {
					case 'move' :
						context.moveTo(arguments[0] + values[0], arguments[1] + values[1]);
						break;
					case 'line' :
						context.lineTo(arguments[0] + values[0], arguments[1] + values[1]);
						break;
					case 'arc' :
						context.arc(arguments[0] + values[0], arguments[1] + values[1], arguments[2], values[3], values[4]);
						break;
				}
			}
		}
	}

	class AppObject {
		paths = [];
		upForDestruction = false;
		canCollide = true;

		constructor(x, y, width, height, paths) {
			this.x = x;
			this.y = y;
			this.width = width;
			this.height = height;
			this.paths = paths ? paths : [];
		}

		setPath(index, path) {
			this.paths[index] = path;
		}

		addPath(path) {
			this.paths.push(path);
		}

		draw() {
			for (let i = 0; i < this.paths.length; i++) {
				context.beginPath();
				this.paths[i].execute(this.x, this.y);
				context.closePath();
				if (this.paths[i].strokeColor) {
					context.strokeStyle = this.paths[i].strokeColor;
					context.stroke();
				}
				if (this.paths[i].fillColor) {
					context.fillStyle = this.paths[i].fillColor;
					context.fill();
				}
			}
		}

		findClosest(object, onlyInside) {
			let closest;
			let shortestDistance;
			for (let i = 0; i < appObjectList.length; i++) {
				let cur = appObjectList[i];
				if (cur instanceof object) {
					if (onlyInside && (cur.x < 0 || cur.x > canvas.width || cur.y < 0 || cur.y > canvas.height)) continue;
					let distance = getDistance(this.x, this.y, cur.x, cur.y);
					if (shortestDistance === undefined || distance < shortestDistance) {
						shortestDistance = distance;
						closest = cur;
					}
				}
			}
			return {
				obj: closest,
				d: shortestDistance
			};
		}

		update() {
		}
	}

	class MovingObject extends AppObject {
		speedX = 0;
		speedY = 0;
		pSpeedX = 0;
		pSpeedY = 0;
		maxSpeed = 1;
		minSpeed = 0.01;
		accel = 1;
		angle = 0;
		airFriction = 0.975;
		edgeBehavior = 'teleport';
		rotationSpeed;

		constructor(x, y, width, height, paths) {
			super(x, y, width, height, paths);
		}

		calcVectorAngle() {
			let addDeg = 0;

			let xStartMoving = this.pSpeedX === 0 && this.speedX !== 0;
			let yStartMoving = this.pSpeedY === 0 && this.speedY !== 0;

			let xChangeDirection = this.pSpeedX / Math.abs(this.pSpeedX) === -1 * this.speedX / Math.abs(this.speedX);
			let yChangeDirection = this.pSpeedY / Math.abs(this.pSpeedY) === -1 * this.speedY / Math.abs(this.speedY);

			if ((this.speedX === 0 || this.speedY === 0) && !(xStartMoving || yStartMoving || xChangeDirection || yChangeDirection)) return this.angle;
			if (this.speedY < 0) {
				addDeg = 180;
			}
			let newAngle = Math.atan(this.speedX / this.speedY) * 180 / Math.PI - addDeg;
			this.angle = newAngle;
			return newAngle;
		}

		move(x, y) {
			this.x += x;
			this.y += y;
		}

		accelerate(x, y) {
			this.speedX = Math.abs(this.speedX + x) > this.maxSpeed ? this.maxSpeed * (x / Math.abs(x)) : this.speedX + x;
			this.speedY = Math.abs(this.speedY + y) > this.maxSpeed ? this.maxSpeed * (y / Math.abs(y)) : this.speedY + y;
		}

		applyVector(v) {
			this.speedX = v.x;
			this.speedY = v.y;
		}

		getInterpolation() {
			return {
				x : this.x + this.speedX,
				y : this.y + this.speedY
			};
		}

		bounceX() {
			this.speedX = -this.speedX;
		}

		bounceY() {
			this.speedY = -this.speedY;
		}

		setRandomMovement() {
			let maxIndividualSpeed = Math.sqrt(this.maxSpeed / 2);
			this.speedX = (2 * Math.random() - 1) * maxIndividualSpeed;
			this.speedY = (2 * Math.random() - 1) * maxIndividualSpeed;
		}

		setRandomRotation() {
			this.rotationSpeed = 2 * Math.random() - 1;
		}

		update() {
			this.pSpeedX = this.speedX;
			this.pSpeedY = this.speedY;

			super.update();

			if (Math.abs(this.speedX) < this.minSpeed) this.speedX = 0;
			if (Math.abs(this.speedY) < this.minSpeed) this.speedY = 0;

			if (this.rotationSpeed) {
				for (let i = 0; i < this.paths.length; i++) {
					this.paths[i].rotate(this.rotationSpeed);
				}
			}

			// movement interpolation
			let interpolation = this.getInterpolation();

			switch (this.edgeBehavior) {
				case 'bounce' :
					if (interpolation.x - this.width < 0 && this.speedX < 0) this.bounceX();
					if (interpolation.x + this.width > canvas.clientWidth && this.speedX > 0) this.bounceX();
					if (interpolation.y - this.height < 0 && this.speedY < 0) this.bounceY();
					if (interpolation.y + this.height > canvas.clientHeight && this.speedY > 0) this.bounceY();
					break;
				case 'teleport' :
					if (interpolation.x + this.width < 0 && this.speedX < 0) this.x = canvas.clientWidth + this.width;
					if (interpolation.x - this.width > canvas.clientWidth && this.speedX > 0) this.x = -this.width;
					if (interpolation.y + this.height < 0 && this.speedY < 0) this.y = canvas.clientHeight + this.height;
					if (interpolation.y - this.height > canvas.clientHeight && this.speedY > 0) this.y = -this.height;
					break;
				case 'destroy' :
					if (interpolation.x + this.width < 0 && this.speedX < 0) this.upForDestruction = true;
					if (interpolation.x - this.width > canvas.clientWidth && this.speedX > 0) this.upForDestruction = true;
					if (interpolation.y + this.height < 0 && this.speedY < 0) this.upForDestruction = true;
					if (interpolation.y - this.height > canvas.clientHeight && this.speedY > 0) this.upForDestruction = true;
					break;
			}

			// friction
			this.speedX *= this.airFriction;
			this.speedY *= this.airFriction;

			// resulting movement
			this.move(this.speedX, this.speedY);
		}

	}

	class Actor extends MovingObject {
		left = false;
		up = false;
		right = false;
		down = false;
		maxHealth;
		health;

		setHealth(newVal) {
			if (newVal > this.maxHealth) this.health = this.maxHealth;
			else this.health = newVal;
		}

		increaseHealth(amount) {
			this.setHealth(this.health + amount);
		}

		update() {
			super.update();
			// actor issued movement handler (e.g. AI or user)
			if (this.left) this.accelerate(-1 * this.accel, 0);
			if (this.up) this.accelerate(0, -1 * this.accel);
			if (this.right) this.accelerate(this.accel, 0);
			if (this.down) this.accelerate(0, this.accel);
		}
	}

	const OPMODE = true;

	class User extends Actor {
		maxSpeed = 15;
		accel = 1;
		maxHealth = 100;

		shooting = false;

		shootingTriple = false;
		tripleAmmo = 20;
		tripleCurrent;
		tripleRecharge = 0.1;
		tripleAfterCoolDown = 50;
		tripleAfterCounter = 0;

		bursting = false;
		burstCoolDown = 500;
		burstCounter = 0;

		shotCoolDown = 10;
		shotCounter = 0;

		iFrames = 100;
		iFramesCounter;

		canShoot;

		userPath = new Polygon([ [ 0, 10 ], [ 10, -10 ], [ 0, -5 ], [ -10, -10 ] ]).createPath();

		constructor(x, y, width, height) {
			super(x, y, width, height, undefined);
			this.userPath.setRotation(0);
			this.addPath(this.userPath);
			if (OPMODE) {
				this.tripleAmmo = 20;
				this.tripleRecharge = 20;
				this.tripleAfterCoolDown = 0;
				this.burstCoolDown = 2;
				this.shotCoolDown = 0;
				this.iFrames = 10000;
			}
			this.tripleCurrent = this.tripleAmmo;
			this.health = this.maxHealth;
		}

		burst() {
			for (let i = 0; i <= 360; i += 360/36) {
				this.launch(i);
			}
			this.burstCounter = this.burstCoolDown;
		}

		launch(angle) {
			appObjectList.push(new Shot(this.x, this.y, this.calcVectorAngle() + angle));
		}

		shoot(angle) {
			this.launch(angle);
			this.shotCounter = this.shotCoolDown;
		}

		shootTriple() {
			this.shoot(10);
			this.shoot(-10);
			this.tripleCurrent -= 2;
			this.tripleAfterCounter = this.tripleAfterCoolDown;
		}

		rechargeTriple() {
			if (this.tripleCurrent + this.tripleRecharge > this.tripleAmmo) {
				this.tripleCurrent = this.tripleAmmo;
			} else {
				this.tripleCurrent += this.tripleRecharge;
			}
		}

		inflictDamage(damage) {
			if (this.iFramesCounter > 0) {
				return false;
			} else {
				console.log('health: ' + this.health);
				console.log('damage: ' + damage);
				if (this.health - damage > 0) {
					this.health -= damage;
					this.iFramesCounter = this.iFrames;
				} else {
					gameOver();
				}
				return true;
			}
		}

		update() {
			// angle from speed
			for (let i = 0; i < this.paths.length; i++) {
				this.paths[i].setRotation(this.calcVectorAngle());
			}

			if (this.iFramesCounter > 0) {
				if (this.iFramesCounter > this.iFrames - 20) {this.userPath.strokeColor = '#ff5555'; this.userPath.fillColor = '#ff9900';}
				else if (this.iFramesCounter % 20 < 10) {this.userPath.strokeColor = '#0099ff'; this.userPath.fillColor = '#00ffff';}
				else if (this.iFramesCounter % 20 >= 10) {this.userPath.strokeColor = 'rgba(0, 153, 255, 0.5)'; this.userPath.fillColor = 'rgba(0, 255, 255, 0.5)';}
			}

			super.update();

			this.canShoot = this.shotCounter === 0;

			if (this.canShoot && this.shooting) this.shoot(0);

			if (this.canShoot && this.tripleCurrent >= 2 && this.shootingTriple) this.shootTriple(); else if (this.tripleCurrent < this.tripleAmmo && this.tripleAfterCounter === 0) this.rechargeTriple();

			if (this.burstCounter === 0 && this.bursting) this.burst();

			if (this.burstCounter > 0) this.burstCounter -= 1;
			if (this.shotCounter > 0) this.shotCounter -= 1;
			if (this.tripleAfterCounter > 0) this.tripleAfterCounter -= 1;
			if (this.iFramesCounter > 0) this.iFramesCounter -=1;
		}
	}

	class Polygon {
		points;

		constructor(points) {
			this.points = points;
		}

		addPoint(point) {
			this.points.push(point);
		}

		setPoint(index, point) {
			this.points[index] = point;
		}

		createPath() {
			let temp = [];
			for (let i = 0; i < this.points.length; i++) {
				if (i === 0) {
					temp.push({
						type : 'move',
						values : [ this.points[i][0], this.points[i][1] ]
					});
				} else {
					temp.push({
						type : 'line',
						values : [ this.points[i][0], this.points[i][1] ]
					});
				}
			}
			return new Path(temp);
		}

	}

	class RegularPolygon extends Polygon {
		constructor(radius, sides) {
			let angle = 2 * Math.PI / sides;
			let points = [];
			for (let i = 0; i < sides; i++) {
				points.push([ radius * Math.cos(i * angle), radius * Math.sin(i * angle) ]);
			}
			super(points);
		}
	}

	class Triangle extends RegularPolygon {
		constructor(radius) {
			super(radius, 3);
		}
	}

	class Rectangle extends Polygon {
		constructor(width, height) {
			super([ [ -width / 2, -height / 2 ], [ -width / 2, height / 2 ], [ width / 2, height / 2 ], [ width / 2, -height / 2 ] ]);
		}
	}

	class Shot extends MovingObject {
		maxSpeed = 10;
		maxLifetime = 200;
		airFriction = 1;
		lifetime = 0;
		edgeBehavior = 'bounce';
		strength;
		triggerDelay;
		triggerTime = 0;
		shotPath = new Rectangle(5, 10).createPath();
		origColor = '#fff';

		constructor(x, y, angle, strength, triggerDelay) {
			super(x, y, 2, 5, undefined);
			this.strength = strength === undefined ? 1 : strength;
			this.triggerDelay = triggerDelay ? triggerDelay : 0;
			this.addPath(this.shotPath);
			this.calcSpeedFromAngle(angle);
		}

		calcSpeedFromAngle(angle) {
			this.speedX = this.maxSpeed * Math.sin(angle / 180 * Math.PI);
			this.speedY = this.maxSpeed * Math.cos(angle / 180 * Math.PI);
		}

		update() {
			// angle from speed
			for (let i = 0; i < this.paths.length; i++) {
				this.paths[i].setRotation(this.calcVectorAngle());
			}

			super.update();
			let opacity = this.maxLifetime > 0 ? 1 / Math.pow(this.maxLifetime, 2) * -1 * Math.pow(this.lifetime, 2) + 1 : 1;
			let rgbValue = hexToRgb(this.origColor);
			this.shotPath.fillColor = 'rgba(' + rgbValue.r + ', ' + rgbValue.g + ', ' + rgbValue.b  + ', ' + opacity + ')';
			this.canCollide = this.triggerTime === this.triggerDelay;
			if (this.triggerTime < this.triggerDelay) this.triggerTime++;
			if (this.lifetime < this.maxLifetime || this.maxLifetime === 0) {
				this.lifetime++;
			} else {
				this.upForDestruction = true;
			}
		}

	}

	class SeekingShot extends Shot {
		seekPrimeDelay = 20;
		maxSpeed = 20;
		maxLifetime = 1000;

		constructor(x, y, angle, strength, triggerDelay) {
			super(x, y, angle, strength, triggerDelay);
		}

		update() {
			super.update();
			if (this.lifetime < this.seekPrimeDelay) return;
			let closest = this.findClosest(Asteroid, true);
			let angle;
			if (closest.obj === undefined) {
				if (getObjDistance(this, user) > 200) {
					angle = - getAngle(this.x, this.y, user.x, user.y) + 90;
				} else {
					angle = - getAngle(this.x, this.y, user.x, user.y) - 185;
				}
			} else {
				closest.obj.paths[0].fillColor = '#f99';
				angle = - getAngle(this.x, this.y, closest.obj.x, closest.obj.y) + 90;
			}
			this.calcSpeedFromAngle(angle);
		}

	}

	class PlayerOrbitingShot extends Shot {
		seekPrimeDelay = 20;
		maxSpeed = 15;
		maxLifetime = 2000;

		constructor(x, y, angle, strength, triggerDelay) {
			super(x, y, angle, strength, triggerDelay);
		}

		update() {
			super.update();
			if (this.lifetime < this.seekPrimeDelay) return;
			let angle;
			let d = getObjDistance(this, user);
			if (d > 300) {
				angle = - getAngle(this.x, this.y, user.x, user.y) + 90;
			} else if (300 >= d && d > 200) {
				angle = - getAngle(this.x, this.y, user.x, user.y) + 5;
			} else if (200 >= d && d > 150) {
				angle = - getAngle(this.x, this.y, user.x, user.y) - 90;
			} else if (150 >= d && d > 100) {
				angle = - getAngle(this.x, this.y, user.x, user.y) + 90;
			} else if (100 >= d && d > 50) {
				angle = - getAngle(this.x, this.y, user.x, user.y) - 175;
			} else {
				angle = - getAngle(this.x, this.y, user.x, user.y) - 90;
			}
			//if (angle === undefined) return;
			this.calcSpeedFromAngle(angle);
		}
	}

	class OrbitingShot extends Shot {
		seekPrimeDelay = 20;
		maxLifetime = 2000;
		orbiting = {
			obj: undefined,
			d: undefined
		};

		constructor(x, y, angle, strength, triggerDelay) {
			super(x, y, angle, strength, triggerDelay);
		}

		update() {
			super.update();
			if (this.lifetime < this.seekPrimeDelay) return;
			if (this.orbiting.obj) {
				let angle;
				this.orbiting.d = getObjDistance(this, this.orbiting.obj);
				let trueD = this.orbiting.d - this.orbiting.obj.size * 10;
				if (trueD > 100) {
					angle = - getAngle(this.x, this.y, this.orbiting.obj.x, this.orbiting.obj.y) + 90;
				} else {
					angle = - getAngle(this.x, this.y, this.orbiting.obj.x, this.orbiting.obj.y) - 180;
				}
				this.calcSpeedFromAngle(angle);
				if (this.orbiting.obj.upForDestruction) {
					this.orbiting = {obj: undefined, d: undefined};
					this.lifetime = 0;
				}
			} else {
				this.orbiting = this.findClosest(Asteroid, true);
			}
		}
	}

	class PayloadShot extends Shot {
		payload;

		constructor(x, y, angle, payload, strength, triggerDelay) {
			super(x, y, angle, strength, triggerDelay);
			this.payload = payload;
		}

		deployPayload() {
			let payloadInstance = new this.payload(this.x, this.y, this.angle);
			appObjectList.push(payloadInstance);
			this.upForDestruction = true;
		}
	}

	class WeirdShot extends PayloadShot {
		constructor(x, y, angle) {
			super(x, y, angle, WeirdBomb, 1, 0);
		}

	}

	class WeirdBomb extends MovingObject {
		constructor(x, y, angle) {
			super(x, y, 20, 20, undefined);
			this.angle = angle;
		}

		update() {
			super.update();
			for (let i = 0; i <= 360; i += 360 / 2) {
				appObjectList.push(new WeirdShot(this.x, this.y, this.angle + i + 90));
			}
			this.upForDestruction = true;
		}
	}

	class BombShot extends PayloadShot {
		constructor(x, y, angle) {
			super(x, y, angle, Bomb, 1, 5);
			this.width = 10;
			this.height = 10;
			this.shotPath = new Triangle(5).createPath();
			this.origColor = '#000';
			this.setPath(0, this.shotPath);
		}
	}

	class RecursiveBombShot extends PayloadShot {
		constructor(x, y, angle) {
			super(x, y, angle, RecursiveBomb, 1, 5);
			this.width = 10;
			this.height = 10;
			this.shotPath = new Triangle(5).createPath();
			this.shotPath.setPermanentRotation(-90);
			this.origColor = '#050';
			this.setPath(0, this.shotPath);
		}
	}

	class BouncingShot extends Shot {
		constructor(x, y, angle, strength, triggerDelay) {
			super(x, y, angle, strength, triggerDelay);
		}
	}

	class SpecialBomb extends MovingObject {
		payload;

		constructor(x, y, angle, payload) {
			super(x, y, 20, 20, undefined);
			this.angle = angle;
			this.payload = payload;
		}

		update() {
			super.update();
			for (let i = 0; i <= 360; i += 360/3) {
				let cur = new this.payload(this.x, this.y, this.angle + i);
				appObjectList.push(cur);
			}
			this.upForDestruction = true;
		}
	}

	class Bomb extends SpecialBomb {
		constructor(x, y, angle) {
			super(x, y, angle, Shot);
		}

	}

	class RecursiveBomb extends SpecialBomb {
		constructor(x, y, angle) {
			super(x, y, angle, BombShot)
		}
	}

	class Pickup extends MovingObject {
		basePath;
		airFriction = 1;
		edgeBehavior = 'bounce';

		constructor(x, y, imgPaths) {
			super(x, y, 20, 20, undefined);
			let basePoly = new Triangle(20);
			this.basePath = basePoly.createPath();
			this.basePath.stroke = '#000';
			this.setPath(0, this.basePath);
			this.setRandomMovement();
			this.setRandomRotation();
			for (let i = 0; i < imgPaths.length; i++) {
				this.addPath(imgPaths[i]);
			}
		}

		onPickup(by) {
			this.upForDestruction = true;
		}
	}

	class HealthPickup extends Pickup {
		healAmount = 10;
		constructor(x, y) {
			let imgPaths = [];
			let imgPoly1 = new Triangle(15);
			let imgPath1 = imgPoly1.createPath();
			imgPath1.fillColor = '#f55';
			super(x, y, imgPaths);
		}

		onPickup(by) {
			by.increaseHealth(10);
			super.onPickup(by);
		}
	}

	let score = 0;

	class Asteroid extends MovingObject {
		asteroidPath;
		airFriction = 1;
		edgeBehavior = 'bounce';
		initialSize;
		size;
		maxSpeed = 30;

		constructor(x, y, size, autoSpeed) {
			super(x, y, size, size, undefined);
			this.size = size;
			this.initialSize = size;
			let asteroidPoly = new RegularPolygon(1, 5);
			this.asteroidPath = asteroidPoly.createPath();
			this.asteroidPath.strokeColor = '#fff';
			this.setPath(0, this.asteroidPath);
			if (autoSpeed === undefined || autoSpeed === true) {
				this.setRandomMovement();
				this.setRandomRotation();
			}
		}

		reduceSize(size) {
			if (this.size - size <= 0) {
				this.upForDestruction = true;
				score += this.initialSize;
			} else {
				this.size -= size;
			}
		}

		update() {
			super.update();
			this.asteroidPath.fillColor = undefined;
			this.asteroidPath.setScale(this.size * asteroidSizeMultiplier);
		}
	}

	class StatusBar extends AppObject {
		strokePath;
		emptyPath;
		statusPath;
		statusColor;
		progress;
		canCollide = false;
		vertical = false;

		constructor(x, y, width, height, fillColor, strokeColor, emptyColor, vertical) {
			super(x, y, width, height, undefined);
			this.strokePath = new Rectangle(width, height).createPath();
			this.strokePath.fillColor = strokeColor;
			this.emptyPath = new Rectangle(width - 5, height - 5).createPath();
			this.emptyPath.fillColor = emptyColor;
			this.statusColor = fillColor;
			this.vertical = vertical ? vertical : false;
			this.addPath(this.strokePath);
			this.addPath(this.emptyPath);
			this.addPath(this.statusPath);
		}

		update() {
			super.update();
			let innerWidth = this.width - 5;
			this.statusPath = new Rectangle(innerWidth * this.progress, this.height - 5).createPath();
			this.statusPath.fillColor = this.statusColor;
			this.statusPath.shift((innerWidth - innerWidth * this.progress) / -2, 0);
			this.setPath(2, this.statusPath);
			if (this.vertical) for (let i = 0; i < this.paths.length; i++) this.paths[i].setRotation(90);
		}
	}

	class SegmentedStatusBar extends StatusBar {
		segments;

		constructor(x, y, width, height, fillColor, strokeColor, emptyColor, segments, vertical) {
			super(x, y, width, height, fillColor, strokeColor, emptyColor, vertical);
			this.segments = segments;
			for (let i = 1; i < segments; i++) {
				let innerWidth = this.width - 5;
				let innerHeight = this.height - 5;
				let segmentPath = new Rectangle(2, innerHeight).createPath();
				segmentPath.fillColor = strokeColor;
				segmentPath.shift((i * innerWidth / segments) - innerWidth / 2, 0);
				this.addPath(segmentPath);
			}
		}
	}

	let user;
	let appTicks;
	let isRunning;

	class HealthStatusBar extends StatusBar {
		constructor(x, y, width, height) {
			super(x, y, width, height, '#f55', '#000', '#555', false);
		}

		update() {
			this.progress = (user.health) / user.maxHealth;
			super.update();
		}

	}

	class TripleStatusBar extends SegmentedStatusBar {
		constructor(x, y, width, height) {
			super(x, y, width, height, '#5f5', '#000', '#555', user.tripleAmmo / 2, true);
		}

		update() {
			this.progress = Math.floor(user.tripleCurrent / 2) * 2 / user.tripleAmmo;
			super.update();
		}
	}

	class BurstStatusBar extends StatusBar {
		constructor(x, y, width, height) {
			super(x, y, width, height, '#55f', '#000', '#555', false);
		}

		update() {
			this.progress = (user.burstCoolDown - user.burstCounter) / user.burstCoolDown;
			super.update();
		}
	}

	class Point {
		x;
		y;

		constructor(x, y) {
			this.x = x;
			this.y = y;
		}
	}


	class Vector2D {
		x;
		y;
		start;
		end;

		constructor(x, y, start) {
			this.x = x;
			this.y = y;
			this.start = start ? start : new Point(0, 0);
			this.end = new Point(this.start.x + this.x, this.start.y + this.y);
		}

		getLength() {
			return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
		}

		normalize() {
			return this.multiply(1/this.getLength());
		}

		multiply(value) {
			return new Vector2D(this.x * value, this.y * value, this.start);
		}

		draw() {
			context.save();
			context.lineWidth = 1;
			context.beginPath();
			let headLength = 10;
			let dx = this.end.x - this.start.x;
			let dy = this.end.y - this.start.y;
			let angle = Math.atan2(dy, dx);
			context.moveTo(this.start.x, this.start.y);
			context.lineTo(this.end.x, this.end.y);
			context.lineTo(this.end.x - headLength * Math.cos(angle - Math.PI / 6), this.end.y - headLength * Math.sin(angle - Math.PI / 6));
			context.moveTo(this.end.x, this.end.y);
			context.lineTo(this.end.x - headLength * Math.cos(angle + Math.PI / 6), this.end.y - headLength * Math.sin(angle + Math.PI / 6));
			context.stroke();
			context.restore();
		}
	}

	function add(v1, v2) {
		return new Vector2D(v1.x + v2.x, v1.y + v2.y, v1.start);
	}

	function subtract(v1, v2) {
		return new Vector2D(v1.x - v2.x, v1.y - v2.y, v1.start)
	}

	function scalar(v1, v2) {
		return v1.x * v2.x + v1.y + v2.y;
	}

	function gameOver() {
		isRunning = false;
	}

	function getAsteroidPosition(size) {
		let side = getRandomIntWithRange(0, 4);
		let x = side === 1 ? -size : side === 3 ? canvas.width + size : getRandomWithRange(0, canvas.width);
		let y = side === 0 ? -size : side === 2 ? canvas.height + size : getRandomWithRange(0, canvas.height);
		return [ x, y ];
	}

	function getNextAsteroid() {
		nextAsteroid = getRandomIntWithRange(minAsteroidInterval, maxAsteroidInterval);
	}

	function getRandomBoolean() {
		return Math.random() < 0.5;
	}

	function getRandomWithRange(min, max) {
		return Math.random() * (max - min) + min;
	}

	function getRandomIntWithRange(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min)) + min;
	}

	function getObjDistance(o1, o2) {
		return Math.sqrt(Math.pow(o2.x - o1.x, 2) + Math.pow(o2.y - o1.y, 2))
	}

	function getDistance(x1, y1, x2, y2) {
		return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
	}

	function getAngle(x1, y1, x2, y2) {
		return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
	}

	let vectorList = [];

	function detectCollision(obj1, obj2) {
		let colliding = false;
		if ((obj1 instanceof Asteroid || obj2 instanceof Asteroid) && !(obj1 instanceof Asteroid && obj2 instanceof Asteroid)) {
			let objAst = obj1 instanceof Asteroid ? obj1 : obj2;
			let objOther = !(obj1 instanceof Asteroid) ? obj1 : obj2;
			for (let i = 0; i < objOther.paths.length; i++) {
				for (let j = 0; j < objOther.paths[i].steps.length; j++) {
					let x1 = objAst.x,
						y1 = objAst.y,
						x2 = objOther.paths[i].steps[j].values[0] + objOther.x,
						y2 = objOther.paths[i].steps[j].values[1] + objOther.y;
					let d = getDistance(x1, y1, x2, y2);
					if (d < objAst.size * asteroidSizeMultiplier) {
						colliding = true;
						if (objOther instanceof PayloadShot) {
							objOther.deployPayload();
						}
						if (objOther instanceof Shot) {
							objAst.reduceSize(objOther.strength);
							objOther.upForDestruction = true;
						} else if (objOther instanceof User) {
							objOther.inflictDamage(objAst.size);
						}
						if (objOther instanceof BouncingShot) {
							objOther.upForDestruction = false;

							let angle = Math.atan2(y2 - y1, x2 - x1);
							let size = objOther.width > objOther.height ? objOther.width : objOther.height;
							let trueD = objAst.size * asteroidSizeMultiplier + size - d;

							objOther.x += Math.cos(angle) * trueD;
							objOther.y += Math.sin(angle) * trueD;

							let normalAngle = angle * 180 / Math.PI;
							let normalVector = new Vector2D(x2 - x1, y2 - y1, new Point(x1, y1));
							let speedVector = new Vector2D(objOther.speedX, objOther.speedY, new Point(x2, y2));
							let speedAngle = Math.atan2(speedVector.y, speedVector.x) * 180 / Math.PI;

							objOther.calcSpeedFromAngle(normalAngle * -1 + 90);
							let newVector = new Vector2D(objOther.speedX, objOther.speedY, new Point(x2, y2));

							vectorList.push(normalVector);
							vectorList.push(speedVector);
							vectorList.push(newVector);
						}
					}
				}
			}
		} else if (obj1 instanceof Asteroid && obj2 instanceof Asteroid) {
			let x1 = obj1.x,
				x2 = obj2.x,
				y1 = obj1.y,
				y2 = obj2.y;
			let d = getDistance(x1, y1, x2, y2);
			if (d < (obj1.size + obj2.size) * asteroidSizeMultiplier) {
				colliding = true;
				let angle = Math.atan2(y2 - y1, x2 - x1);
				let trueD = (obj1.size * asteroidSizeMultiplier + obj2.size * asteroidSizeMultiplier) - d;

				// Place circles on their edges
				obj2.x += Math.cos(angle) * trueD;
				obj2.y += Math.sin(angle) * trueD;

				// Physics

				let obj1V = new Vector2D(obj1.speedX, obj1.speedY, new Point(obj1.x, obj1.y));
				let obj2V = new Vector2D(obj2.speedX, obj2.speedY, new Point(obj2.x, obj2.y));

				let normalVector = new Vector2D(obj2.x - obj1.x, obj2.y - obj1.y, new Point(obj1.x, obj1.y)).normalize();
				let tangentVector = new Vector2D(-normalVector.y, normalVector.x, new Point((obj1.x + obj2.x) / 2, (obj1.y + obj2.y) / 2))

				let nComponent1 = normalVector.multiply(scalar(obj1V, normalVector));
				let nComponent2 = normalVector.multiply(scalar(obj2V, normalVector));

				let tComponent1 = subtract(obj1V, nComponent1);
				let tComponent2 = subtract(obj2V, nComponent2);

				vectorList.push(obj1V.multiply(100));
				//vectorList.push(obj2V.multiply(100));

				vectorList.push(nComponent1.multiply(100));
				//vectorList.push(nComponent2.multiply(100));

				vectorList.push(tComponent1.multiply(100));
				//vectorList.push(tComponent2.multiply(100));

				let v1a = parseAngle(Math.atan2(obj1V.y, obj1V.x));
				let v2a = parseAngle(Math.atan2(obj2V.y, obj2V.x));

				let nC1a = parseAngle(Math.atan2(nComponent1.y, nComponent1.x));
				let tC1a = parseAngle(Math.atan2(tComponent1.y, nComponent1.x));
				let nC2a = parseAngle(Math.atan2(nComponent2.y, nComponent2.x));
				let tC2a = parseAngle(Math.atan2(tComponent2.y, nComponent2.x));

				console.log('v1a: ' + v1a + '; v2a: ' + v2a);
				console.log('nC1a: ' + nC1a + '; tC1a: ' + tC1a + '; diff: ' + (nC1a - tC1a));

			}
		}
		if (colliding) {
			obj1.colliding = true;
			obj2.colliding = true;
		}
		return colliding;
	}

	function parseAngle(rad) {
		return rad * 180 / Math.PI + 180;
	}

	//=== stolen helper methods
	function componentToHex(c) {
		let hex = c.toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	}

	function rgbToHex(r, g, b) {
		return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
	}

	function hexToRgb(hex) {
		// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
		let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
		hex = hex.replace(shorthandRegex, function(m, r, g, b) {
			return r + r + g + g + b + b;
		});

		let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}
	//

	let keystates = {};

	function keyListener(evt) {
		keystates[evt.keyCode] = (evt.type === 'keydown');
		keystates[evt.keyCode] = (evt.type !== 'keyup');
	}

	let curAsteroidCounter = 0;
	let nextAsteroid;
	let minAsteroidInterval;
	let maxAsteroidInterval;
	let minAsteroidSize;
	let maxAsteroidSize;
	let asteroidSizeMultiplier = 10;

	const DEBUG = true;
	const VECTOR_ARROWS = true;

	function appLoop() {
		if (!isRunning) return;
		requestAnimationFrame(appLoop);

		appTicks++;

		if (!DEBUG) {
			// add asteroids
			if (curAsteroidCounter === nextAsteroid) {
				getNextAsteroid();
				let size = getRandomIntWithRange(minAsteroidSize, maxAsteroidSize + 1);
				let position = getAsteroidPosition(size * asteroidSizeMultiplier);
				appObjectList.push(new Asteroid(position[0], position[1], size));
				curAsteroidCounter = 0;
			}
			curAsteroidCounter++;
		}

		// user inputs
		user.left = keystates[37];
		user.up = keystates[38];
		user.right = keystates[39];
		user.down = keystates[40];

		user.shooting = keystates[32];
		user.shootingTriple = keystates[32] && keystates[16];
		user.bursting = keystates[17];

		user.rL = keystates[65];
		user.rR = keystates[68];

		// updating all objects
		for (let i = 0; i < appObjectList.length; i++) {
			let cur = appObjectList[i];
			if (cur === undefined) continue;
			if ((cur.x < 0 || cur.x > canvas.width || cur.y < 0 || cur.y > canvas.height) && (cur.speedX === 0 && cur.speedY === 0) && !(cur instanceof User)) cur.upForDestruction = true;
			if (cur.upForDestruction) {
				appObjectList[i] = undefined;
				continue;
			}
			if (cur.canCollide) {
				for (let j = i + 1; j < appObjectList.length; j++) {
					if (!appObjectList[j].canCollide) continue;
					detectCollision(cur, appObjectList[j])
				}
			}
			cur.update();
		}

		// clean object list of deleted objects
		appObjectList.clean(undefined);
		appObjectList.clean(null);

		// clear canvas
		context.fillStyle = 'rgb(50, 50, 50)';
		context.fillRect(0, 0, canvas.width, canvas.height);

		// draw all objects
		//for (let i = 0; i < appObjectList.length; i++) {
		for (let i = appObjectList.length - 1; i >= 0; i--) {
			let cur = appObjectList[i];
			if (cur === undefined) continue;
			cur.draw();
			// draw speed vector
			if (VECTOR_ARROWS) {
				if (cur instanceof MovingObject) {
					new Vector2D(cur.speedX * 10, cur.speedY * 10, new Point(cur.x, cur.y)).draw();
				}
			}
		}

		let drewVectors = false;

		for (let i = 0; i < vectorList.length; i++) {
			let cur = vectorList[i];
			if (cur === undefined) continue;
			context.strokeStyle = 'red';
			cur.draw();
			vectorList[i] = undefined;
			vectorList.clean(undefined);
			drewVectors = true;
		}

		//console.log(score);
		if (drewVectors) debugger;
	}

	function setup() {
		window.addEventListener("resize", function() {
			canvas.width = canvas.clientWidth;
			canvas.height = canvas.clientHeight;
			context.imageSmoothingEnabled = false;
		});
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		context.imageSmoothingEnabled = false;

		appTicks = 0;

		// ### user setup
		user = new User(canvas.width / 2, canvas.height / 2, 20, 10);

		user.userPath.fillColor = '#00ffff';
		user.doFill = true;
		user.userPath.strokeColor = '#0099ff';
		context.lineWidth = 10;
		user.doStroke = true;

		appObjectList.push(user);

		// ### status bar setup
		let barTriple = new TripleStatusBar(20, canvas.height - 110, 200, 20);
		let barBurst = new BurstStatusBar(90, canvas.height - 20, 100, 20);
		let barHealth = new HealthStatusBar(90, canvas.height - 50, 100, 20);

		appObjectList.push(barTriple);
		appObjectList.push(barBurst);
		appObjectList.push(barHealth);

		// ### asteroids
		minAsteroidInterval = 20;
		maxAsteroidInterval = 50;
		minAsteroidSize = 1;
		maxAsteroidSize = 10;
		getNextAsteroid();

		if (DEBUG) {
			let ast1 = new Asteroid(canvas.width / 2 - 150, canvas.height / 2 - 100, 10, false);
			let ast2 = new Asteroid(canvas.width / 2 + 150, canvas.height / 2, 10, false);

			ast1.speedX = 5;
			ast2.speedX = -5;
			appObjectList.push(ast1);
			appObjectList.push(ast2);
		}

		// ### add key listeners
		addEventListener('keydown', keyListener);
		addEventListener('keyup', keyListener);

		isRunning = true;
		requestAnimationFrame(appLoop);
	}

	//Entry point
	setup();

}(document.querySelector('canvas'), document.querySelector('canvas').getContext('2d')));
