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

		fillColor;
		strokeColor;

		rotation = 0;

		constructor(steps) {
			this.steps = steps ? steps : [];
			this.origSteps = JSON.parse(JSON.stringify(this.steps));
		}

		setRotation(newVal) {
			while (newVal > 360) newVal -= 360;
			while (newVal < 0) newVal += 360;
			this.rotation = newVal;

			for (let i = 0; i < this.steps.length; i++) {
				let origStep = this.origSteps[i], origValues = origStep.values, origX = origValues[0], origY = origValues[1],
					radians = (Math.PI / 180) * this.rotation, sin = Math.sin(radians), cos = Math.cos(radians);
				this.steps[i].values[0] = (cos * origX) + (sin * origY);
				this.steps[i].values[1] = (cos * origY) - (sin * origX);
			}
		}

		setScale(newVal) {
			for (let i = 0; i < this.steps.length; i++) {
				let origStep = this.origSteps[i], origValues = origStep.values, origX = origValues[0], origY = origValues[1];
				this.steps[i].values[0] = origX * newVal;
				this.steps[i].values[1] = origY * newVal;
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
			}
		}

		execute() {
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

		update() {
		}
	}

	class MovingObject extends AppObject {
		speedX = 0;
		speedY = 0;
		maxSpeed = 100;
		accel = 1;
		airFriction = 0.975;
		edgeBehavior = 'teleport';
		rotationSpeed;

		calcVectorAngle() {
			let addDeg = 0;
			if (this.speedX === 0 && this.speedY === 0) return 0;
			if (this.speedY < 0) {
				addDeg = 180;
			}
			return Math.atan(this.speedX / this.speedY) * 180 / Math.PI - addDeg;
		}

		move(x, y) {
			this.x += x;
			this.y += y;
		}

		accelerate(x, y) {
			this.speedX = Math.abs(this.speedX + x) > this.maxSpeed ? this.maxSpeed * (x / Math.abs(x)) : this.speedX + x;
			this.speedY = Math.abs(this.speedY + y) > this.maxSpeed ? this.maxSpeed * (y / Math.abs(y)) : this.speedY + y;
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
			super.update();

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
		health;

		update() {
			super.update();
			// actor issued movement handler
			if (this.left) this.accelerate(-1 * this.accel, 0);
			if (this.up) this.accelerate(0, -1 * this.accel);
			if (this.right) this.accelerate(this.accel, 0);
			if (this.down) this.accelerate(0, this.accel);
		}
	}

	class User extends Actor {
		maxSpeed = 15;
		accel = 1;
		health = 100;

		shooting = false;

		shootingTriple = false;
		tripleAmmo = 20;
		tripleCurrent = this.tripleAmmo;
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
			console.log(this.userPath);
			this.addPath(this.userPath);
		}

		burst() {
			for (let i = 0; i <= 360; i += 10) {
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

	class Rectangle extends Polygon {
		constructor(width, height) {
			super([ [ -width / 2, -height / 2 ], [ -width / 2, height / 2 ], [ width / 2, height / 2 ], [ width / 2, -height / 2 ] ]);
		}
	}

	class Square extends Rectangle {
		constructor(size) {
			super(size, size);
		}
	}

	class Shot extends MovingObject {
		maxSpeed = 20;
		maxLifetime = 200;
		airFriction = 1;
		lifetime = 0;
		edgeBehavior = 'bounce';
		strength;
		shotPath = new Rectangle(5, 10).createPath();

		constructor(x, y, angle, strength) {
			super(x, y, 2, 5, undefined);
			this.strength = strength ? strength : 1;
			this.shotPath.fillColor = 'rgb(255,0,0)';
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
			let opacity = 1 / Math.pow(this.maxLifetime, 2) * -1 * Math.pow(this.lifetime, 2) + 1;
			this.shotPath.fillColor = 'rgba(255,255,255,' + opacity + ')';
			if (this.lifetime < this.maxLifetime) {
				this.lifetime++;
			} else {
				this.upForDestruction = true;
			}
		}

	}

	let score = 0;

	class Asteroid extends Actor {
		asteroidPath;
		airFriction = 1;
		edgeBehavior = 'bounce';
		initialSize;
		size;

		constructor(x, y, size) {
			super(x, y, size, size, undefined);
			this.size = size;
			this.initialSize = size;
			this.updateAsteroidPath();
			this.setRandomMovement();
			this.setRandomRotation();
		}

		reduceSize(size) {
			if (this.size - size <= 0) {
				this.upForDestruction = true;
				score += this.initialSize;
			} else {
				this.size -= size;
			}
		}

		updateAsteroidPath() {
			let asteroidPoly = new RegularPolygon(this.size * asteroidSizeMultiplier, 5);
			this.asteroidPath = asteroidPoly.createPath();
			this.asteroidPath.strokeColor = '#fff';
			this.setPath(0, this.asteroidPath);
		}

		update() {
			super.update();
			this.updateAsteroidPath();
		}
	}

	class StatusBar extends AppObject {
		strokePath;
		emptyPath;
		statusPath;
		statusColor;
		progress;
		canCollide = false;

		constructor(x, y, width, height, fillColor, strokeColor, emptyColor) {
			super(x, y, width, height);
			this.strokePath = new Rectangle(width, height).createPath();
			this.strokePath.fillColor = strokeColor;
			this.emptyPath = new Rectangle(width - 5, height - 5).createPath();
			this.emptyPath.fillColor = emptyColor;
			this.statusColor = fillColor;
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
		}
	}

	class SegmentedStatusBar extends StatusBar {
		segments;

		constructor(x, y, width, height, fillColor, strokeColor, emptyColor, segments) {
			super(x, y, width, height, fillColor, strokeColor, emptyColor);
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

	class TripleStatusBar extends SegmentedStatusBar {
		constructor(x, y, width, height) {
			super(x, y, width, height, '#5f5', '#000', '#555', user.tripleAmmo / 2);
		}

		update() {
			this.progress = Math.floor(user.tripleCurrent / 2) * 2 / user.tripleAmmo;
			super.update();
		}
	}

	class BurstStatusBar extends StatusBar {
		constructor(x, y, width, height) {
			super(x, y, width, height, '#55f', '#000', '#555');
		}

		update() {
			this.progress = (user.burstCoolDown - user.burstCounter) / user.burstCoolDown;
			super.update();
		}
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

	function getDistance(x1, y1, x2, y2) {
		return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
	}

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
						if (objOther instanceof Shot) {
							objAst.reduceSize(objOther.strength);
							objOther.upForDestruction = true;
						} else if (objOther instanceof User) {
							objOther.inflictDamage(objAst.size);
						}
					}
				}
			}
		}
		if (colliding) {
			obj1.colliding = true;
			obj2.colliding = true;
		}
		return colliding;
	}

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

	function appLoop() {
		if (!isRunning) return;
		requestAnimationFrame(appLoop);

		appTicks++;

		// add asteroids
		if (curAsteroidCounter === nextAsteroid) {
			getNextAsteroid();
			let size = getRandomIntWithRange(minAsteroidSize, maxAsteroidSize + 1);
			let position = getAsteroidPosition(size * asteroidSizeMultiplier);
			appObjectList.push(new Asteroid(position[0], position[1], size));
			curAsteroidCounter = 0;
		}
		curAsteroidCounter++;

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
		for (let i = 0; i < appObjectList.length; i++) {
			let cur = appObjectList[i];
			if (cur === undefined) continue;
			cur.draw();
		}
		console.log(score);
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
		let barTriple = new TripleStatusBar(110, 20, 200, 20);
		let barBurst = new BurstStatusBar(270, 20, 100, 20);

		appObjectList.push(barTriple);
		appObjectList.push(barBurst);

		// ### asteroids
		minAsteroidInterval = 20;
		maxAsteroidInterval = 50;
		minAsteroidSize = 1;
		maxAsteroidSize = 10;
		getNextAsteroid();

		// ### add key listeners
		addEventListener('keydown', keyListener);
		addEventListener('keyup', keyListener);

		isRunning = true;
		requestAnimationFrame(appLoop);
	}

	//Entrypoint
	setup();

}(document.querySelector('canvas'), document.querySelector('canvas').getContext('2d')));
