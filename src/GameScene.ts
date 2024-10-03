import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private dangerPads!: Phaser.Physics.Arcade.StaticGroup
  private background!: Phaser.GameObjects.TileSprite
  private playerSpeed: number = 300
  private jumpVelocity: number = -450 // Reduced from -700
  private maxJumpVelocity: number = -600 // New property for maximum jump velocity
  private nextPlatformY: number = 600
  private platformGap: number = 150; // Increased from 100
  private platformScaleX: number = 0.4; // Reduced from 0.5
  private platformScaleY: number = 0.25; // Reduced from 0.35
  private minPlatformWidth: number = 200; // Increased from 100
  private maxPlatformWidth: number = 400; // Increased from 200
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private lastPlatformX: number = 400
  private clouds!: Phaser.GameObjects.Group
  private jumpTimer: number = 0 // New property to track jump duration
  private maxJumpTime: number = 300 // Maximum time (in ms) the jump can be held
  private isGameOver: boolean = false
  private coyoteTime: number = 150; // Coyote time in milliseconds
  private lastGroundedTime: number = 0;
  private gameStartTime: number = 0;
  private lineCounter: number = 0;
  private lastDangerLine: number = -2; // Initialize to -2 to allow a danger pad on the first or second line
  private jumpPressed: boolean = false;
  private jumpBufferTime: number = 150; // Buffer time in milliseconds
  private lastJumpPressTime: number = 0;
  private cameraLerpFactor: number = 0.1; // New property for smooth camera movement
  private score: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private lastScoreY: number = 0;
  private difficultyLevel: number = 0;
  private readonly pointsPerDifficultyIncrease: number = 20;
  private leftButton!: Phaser.GameObjects.Rectangle;
  private rightButton!: Phaser.GameObjects.Rectangle;
  private jumpButton!: Phaser.GameObjects.Rectangle;
  private isMobile: boolean = false;
  private leftButtonDown: boolean = false;
  private rightButtonDown: boolean = false;
  private jumpButtonDown: boolean = false;
  private jumpZone!: Phaser.GameObjects.Zone;
  private gameWidth: number = 1600;
  private gameHeight: number = 1200;
  private scaleFactor: number = 1;
  private playerScale: number = 0.2;
  private platformScale: number = 1;
  private jumpZoneRight!: Phaser.GameObjects.Zone;
  private jumpZoneLeft!: Phaser.GameObjects.Zone;
  private defaultWidth: number = 1600;
  private defaultHeight: number = 1200;
  private mobileScaleFactor: number = 0.6; // New property for mobile scaling
  private maxDifficultyLevel: number = 30; // New property to cap difficulty
  private dangerPadChance: number = 0.3; // Increased from 0.2
  private mobileSpeedFactor: number = 0.6; // New property to adjust speed on mobile
  private mobilePlatformScaleX: number = 0.8; // New property for mobile platform horizontal scale
  private mobilePlatformScaleY: number = 0.5; // New property for mobile platform vertical scale
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  constructor() {
    super('GameScene')
  }

  init() {
    // Check if the game is running on a mobile device
    this.isMobile = this.sys.game.device.input.touch && !this.sys.game.device.input.mouse;

    // Get the actual screen dimensions
    const { width, height } = this.sys.game.canvas;

    if (this.isMobile) {
      // For mobile, use a taller rectangle and apply mobile scaling
      this.gameWidth = Math.min(width, 450);  // Limit width on very wide mobile screens
      this.gameHeight = height;
      this.mobileScaleFactor = Math.min(this.gameWidth / this.defaultWidth, this.gameHeight / this.defaultHeight) * 0.6;
    } else {
      // For desktop, keep the square aspect ratio
      this.scaleFactor = Math.min(width / this.defaultWidth, height / this.defaultHeight);
      this.gameWidth = this.defaultWidth;
      this.gameHeight = this.defaultHeight;
    }

    // Calculate scale factor
    this.scaleFactor = Math.min(width / this.gameWidth, height / this.gameHeight);

    // Adjust game size
    this.cameras.main.setViewport(0, 0, this.gameWidth * this.scaleFactor, this.gameHeight * this.scaleFactor);
  }

  preload() {
    this.load.image('background', 'assets/bg.png')
    this.load.image('player', 'assets/da-boi.png')
    this.load.image('safe-pad-1', 'assets/Pad-1.png')
    this.load.image('safe-pad-2', 'assets/Pad-3.png')
    this.load.image('danger-pad', 'assets/danger-pad.png')
    this.load.image('cloud1', 'assets/1.png')
    this.load.image('cloud2', 'assets/2.png')
    this.load.image('cloud3', 'assets/4.png')
  }

  create() {
    // Adjust world bounds
    this.physics.world.setBounds(0, -Infinity, this.gameWidth, this.gameHeight + Infinity);

    // Create the background
    this.background = this.add.tileSprite(this.gameWidth / 2, this.gameHeight / 2, this.gameWidth, this.gameHeight, 'background')
    this.background.setScrollFactor(0)
    this.background.setDepth(-1)

    // Create a group for clouds
    this.clouds = this.add.group()

    this.platforms = this.physics.add.staticGroup()
    this.dangerPads = this.physics.add.staticGroup()

    // Adjust initial platform and player positions
    const initialPlatformY = this.gameHeight - 50 * (this.isMobile ? this.mobileScaleFactor : 1);
    const initialPlatform = this.platforms.create(this.gameWidth / 2, initialPlatformY, 'safe-pad-1') as Phaser.Physics.Arcade.Sprite
    initialPlatform.setScale(
      this.platformScaleX * (this.isMobile ? this.mobileScaleFactor : this.platformScale),
      this.platformScaleY * (this.isMobile ? this.mobileScaleFactor : this.platformScale)
    )
    initialPlatform.refreshBody()

    this.nextPlatformY = initialPlatformY;

    // Create the player just above the initial platform
    const playerY = initialPlatformY - (this.platformGap * (this.isMobile ? this.mobileScaleFactor : 1) / 2)
    this.player = this.physics.add.sprite(this.gameWidth / 2, playerY, 'player')
    
    // Adjust player scale based on screen size
    this.playerScale = this.isMobile ? 0.3 * this.mobileScaleFactor : Math.min(0.2, 0.2 * this.scaleFactor);
    this.player.setScale(this.playerScale)
    
    this.player.setBounce(0.1)
    this.player.setCollideWorldBounds(false)
    this.player.setDepth(10)

    // Add initial platforms
    for (let i = 0; i < 10; i++) {
      this.addPlatform()
    }

    // Replace the simple collider with a callback
    this.physics.add.collider(this.player, this.platforms, this.handlePlatformCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback)
    this.physics.add.collider(this.player, this.dangerPads, this.hitDangerPad as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback)

    // Update camera follow settings
    this.cameras.main.startFollow(this.player, false, 0.5, 0.5);
    this.cameras.main.setLerp(this.cameraLerpFactor, this.cameraLerpFactor);
    this.cameras.main.setDeadzone(100, 200);
    
    // Adjust camera bounds
    this.cameras.main.setBounds(0, -10000, this.gameWidth, this.gameHeight + 20000);

    // Store the game start time
    this.gameStartTime = this.time.now;

    // Initialize cursors
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add gravity to the player
    this.player.setGravityY(400)

    // Spawn initial clouds after player is created
    for (let i = 0; i < 5; i++) {
      this.spawnCloud()
    }

    // Add score text
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(20);

    this.lastScoreY = this.player.y;

    // Initialize difficulty
    this.updateDifficulty();

    if (this.isMobile) {
      this.createMobileControls();
    }
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    // Apply camera offset after 10 seconds
    if (time - this.gameStartTime > 10000 && this.cameras.main.followOffset.y === 0) {
      this.cameras.main.setFollowOffset(0, 200);
    }

    if (this.isMobile) {
      this.handleMobileControls();
    } else {
      this.handleKeyboardControls();
    }

    // Update last grounded time
    if (this.player.body!.touching.down) {
      this.lastGroundedTime = time;
    }

    // Add new platforms as the player moves up
    while (this.player.y < this.nextPlatformY + this.gameHeight) {
      this.addPlatform()
    }

    // Remove platforms that are far below the player
    this.platforms.children.entries.forEach((platform: Phaser.GameObjects.GameObject) => {
      const platformSprite = platform as Phaser.Physics.Arcade.Sprite
      if (platformSprite.y > this.player.y + 800) {
        this.platforms.remove(platformSprite, true, true)
      }
    })

    this.dangerPads.children.entries.forEach((pad: Phaser.GameObjects.GameObject) => {
      const padSprite = pad as Phaser.Physics.Arcade.Sprite
      if (padSprite.y > this.player.y + 800) {
        this.dangerPads.remove(padSprite, true, true)
      }
    })

    // Spawn new clouds as the player moves up
    if (Phaser.Math.Between(1, 100) === 1) {
      this.spawnCloud()
    }

    // Remove clouds that are far below the player
    this.clouds.children.entries.forEach((cloud: Phaser.GameObjects.GameObject) => {
      const cloudSprite = cloud as Phaser.GameObjects.Image
      if (cloudSprite.y > this.player.y + 800) {
        this.clouds.remove(cloudSprite, true, true)
      }
    })

    // Game over if player falls below two platform levels from the bottom of the screen
    const bottomOfScreen = this.cameras.main.scrollY + this.cameras.main.height;
    if (this.player.y > bottomOfScreen + this.platformGap * 2) {
      this.playerFell();
      return;
    }

    // Update camera position smoothly
    this.updateCameraPosition();

    // Update the background position
    this.background.tilePositionY = this.cameras.main.scrollY

    // Update score
    this.updateScore();

    // Update difficulty
    this.updateDifficulty();
  }

  private handlePlatformCollision = (player: Phaser.Types.Physics.Arcade.GameObjectWithBody, platform: Phaser.Types.Physics.Arcade.GameObjectWithBody) => {
    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;

    if (playerBody && platformBody && playerBody.touching.down && playerBody.bottom <= platformBody.top + 5) {
      // Player is on top of the platform
      playerBody.velocity.y = 0;
      (player as Phaser.Physics.Arcade.Sprite).y = platformBody.top - playerBody.height / 2;
      
      // If the platform is moving, adjust player's x position
      if (this.difficultyLevel >= 1) {
        const platformSprite = platform as Phaser.Physics.Arcade.Sprite;
        const platformTween = this.tweens.getTweensOf(platformSprite)[0] as Phaser.Tweens.Tween;
        if (platformTween && platformTween.data && platformTween.data[0]) {
          const platformVelocity = platformTween.data[0].current - platformTween.data[0].previous;
          (player as Phaser.Physics.Arcade.Sprite).x += platformVelocity;
        }
      }
    } else if (playerBody) {
      // Player hit the platform from below or the side
      if (playerBody.touching.up) {
        playerBody.velocity.y = Math.abs(playerBody.velocity.y);
      }
      if (playerBody.touching.left || playerBody.touching.right) {
        playerBody.velocity.x = 0;
      }
    }
  }

  private addPlatform() {
    const scaleFactor = this.isMobile ? this.mobileScaleFactor : 1;
    const minX = 0;
    const maxX = this.gameWidth;

    // Define platform sizes (adjusted for mobile)
    const minWidth = this.isMobile ? 250 * scaleFactor : 200 * scaleFactor;
    const maxWidth = this.isMobile ? 450 * scaleFactor : 400 * scaleFactor;

    // Create two platforms per row
    const platforms: { x: number, width: number, isDanger: boolean }[] = [];

    // First platform
    const width1 = Phaser.Math.Between(minWidth, maxWidth);
    const x1 = Phaser.Math.Between(minX, Math.max(minX, maxX / 2 - width1));
    platforms.push({ x: x1, width: width1, isDanger: false });

    // Second platform
    const width2 = Phaser.Math.Between(minWidth, maxWidth);
    const x2 = Phaser.Math.Between(Math.min(maxX - width2, maxX / 2), maxX - width2);
    platforms.push({ x: x2, width: width2, isDanger: false });

    // Determine if this line can have a danger pad
    const canHaveDangerPad = this.lineCounter - this.lastDangerLine >= 3;
    if (canHaveDangerPad && Math.random() < this.dangerPadChance) {
      const dangerIndex = Phaser.Math.Between(0, 1);
      platforms[dangerIndex].isDanger = true;
      this.lastDangerLine = this.lineCounter;
    }

    const y = this.nextPlatformY - this.platformGap * scaleFactor;

    // Create platforms
    platforms.forEach(platform => {
      this.createPlatform(platform.x, y, platform.width, platform.isDanger);
    });

    this.nextPlatformY = y;
    this.lineCounter++;
  }

  private createPlatform(x: number, y: number, width: number, isDanger: boolean): void {
    let platform: Phaser.Physics.Arcade.Sprite

    if (isDanger) {
      platform = this.dangerPads.create(x, y, 'danger-pad') as Phaser.Physics.Arcade.Sprite
    } else {
      const safePadTexture = Phaser.Math.Between(0, 1) === 0 ? 'safe-pad-1' : 'safe-pad-2'
      platform = this.platforms.create(x, y, safePadTexture) as Phaser.Physics.Arcade.Sprite
    }

    const scaleFactor = this.isMobile ? this.mobileScaleFactor : this.platformScale;
    const horizontalScale = (width / platform.width) * (this.isMobile ? this.mobilePlatformScaleX : this.platformScaleX) * scaleFactor
    const verticalScale = (this.isMobile ? this.mobilePlatformScaleY : this.platformScaleY) * scaleFactor
    platform.setScale(horizontalScale, verticalScale)
    const platformHeight = platform.height * verticalScale
    platform.setSize(width, platformHeight)
    platform.setOffset((platform.width - width) / 2, (platform.height - platformHeight) / 2)
    platform.setDepth(5)
    platform.refreshBody()

    if (this.difficultyLevel >= 1) {
      this.addPlatformMovement(platform);
    }
  }

  private addPlatformMovement(platform: Phaser.Physics.Arcade.Sprite) {
    const moveDistance = 100 * this.scaleFactor;
    const moveDuration = 2000;

    this.tweens.add({
      targets: platform,
      x: platform.x + moveDistance,
      duration: moveDuration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        if (platform.body) {
          platform.body.updateFromGameObject();
        }
      }
    });
  }

  private hitDangerPad = (_player: Phaser.Types.Physics.Arcade.GameObjectWithBody): void => {
    if (!this.isGameOver) {
      this.isGameOver = true;
      this.gameOver(_player as Phaser.Physics.Arcade.Sprite);
    }
  }

  private playerFell = (): void => {
    if (!this.isGameOver) {
      this.isGameOver = true;
      this.gameOver(this.player);
    }
  }

  private gameOver(player: Phaser.Physics.Arcade.Sprite): void {
    // Disable player input and physics
    player.setVelocity(0, 300); // Set a downward velocity
    player.body?.setAllowGravity(false);

    // Turn the player red
    player.setTint(0xff0000);

    // Turn the player upside down
    player.setFlipY(true);

    // Add a falling animation
    const bottomOfScreen = this.cameras.main.scrollY + this.cameras.main.height;
    const fallDestination = Math.min(player.y + 200, bottomOfScreen + this.platformGap * 2);
    
    this.tweens.add({
      targets: player,
      angle: 360, // Make a full rotation
      y: fallDestination,
      duration: 1500, // Longer duration for more visible fall
      ease: 'Power2',
      onComplete: () => {
        // Restart the scene after a short delay
        this.time.delayedCall(500, () => {
          this.scene.restart();
        });
      }
    });

    // Display final score
    const finalScoreText = this.add.text(
      this.cameras.main.worldView.centerX, 
      this.cameras.main.worldView.centerY, 
      `Final Score: ${this.score}`, 
      {
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }
    );
    finalScoreText.setOrigin(0.5);
    finalScoreText.setScrollFactor(0);
    finalScoreText.setDepth(30);
  }

  private spawnCloud() {
    const x = Phaser.Math.Between(0, this.gameWidth)
    const y = this.player ? this.player.y - 600 - Phaser.Math.Between(0, 200) : Phaser.Math.Between(0, 600)
    const cloudType = Phaser.Math.Between(1, 3)
    const cloud = this.add.image(x, y, `cloud${cloudType}`)
    
    cloud.setAlpha(0.7) // Make clouds slightly transparent
    cloud.setScale(Phaser.Math.FloatBetween(0.5, 1.5)) // Random cloud size
    cloud.setDepth(1) // Set cloud depth to be just above the background
    
    this.clouds.add(cloud)
    
    // Add a slight horizontal movement to the cloud
    this.tweens.add({
      targets: cloud,
      x: cloud.x + Phaser.Math.Between(-50, 50),
      duration: Phaser.Math.Between(10000, 20000),
      ease: 'Linear',
      yoyo: true,
      repeat: -1
    })
  }

  private updateCameraPosition() {
    const targetY = this.player.y - this.cameras.main.height * 0.6;
    const currentY = this.cameras.main.scrollY;
    const newY = Phaser.Math.Linear(currentY, targetY, this.cameraLerpFactor);
    this.cameras.main.setScroll(this.cameras.main.scrollX, newY);
  }

  private updateScore() {
    const currentY = this.player.y;
    if (currentY < this.lastScoreY - this.platformGap) {
      this.score++;
      this.scoreText.setText(`Score: ${this.score} (Level ${this.difficultyLevel + 1})`);
      this.lastScoreY = currentY;
    }
  }

  private updateDifficulty() {
    const newDifficultyLevel = Math.floor(this.score / this.pointsPerDifficultyIncrease);
    if (newDifficultyLevel > this.difficultyLevel && newDifficultyLevel <= this.maxDifficultyLevel) {
      this.difficultyLevel = newDifficultyLevel;
      this.applyDifficultyChanges();
    }
  }

  private applyDifficultyChanges() {
    const scaleFactor = this.isMobile ? this.mobileScaleFactor : 1;
    
    // Increase player speed (adjust based on player scale and mobile factor)
    this.playerSpeed = Math.min(500, (300 + (this.difficultyLevel * 5)) * scaleFactor);

    // Adjust platform gap based on difficulty
    this.platformGap = Math.max(120, 150 - (this.difficultyLevel * 1));

    // Adjust jump velocity and max jump velocity
    this.jumpVelocity = Math.max(-500, -450 - (this.difficultyLevel * 2));
    this.maxJumpVelocity = Math.max(-600, -550 - (this.difficultyLevel * 2));

    // Increase chance of danger pads (capped at 60%)
    this.dangerPadChance = Math.min(0.6, 0.3 + (this.difficultyLevel * 0.02));
  }

  private createMobileControls() {
    // Remove existing button creation code

    // Create a zone for the entire screen
    this.jumpZone = this.add.zone(0, 0, this.gameWidth, this.gameHeight)
      .setOrigin(0)
      .setInteractive()
      .setScrollFactor(0);

    // Add touch event listeners
    this.input.on('pointerdown', this.handleTouchStart, this);
    this.input.on('pointermove', this.handleTouchMove, this);
    this.input.on('pointerup', this.handleTouchEnd, this);
  }

  private handleTouchStart = (pointer: Phaser.Input.Pointer) => {
    this.touchStartX = pointer.x;
    this.touchStartY = pointer.y;
    this.jumpButtonDown = true;
  }

  private handleTouchMove = (pointer: Phaser.Input.Pointer) => {
    const deltaX = pointer.x - this.touchStartX;
    this.player.x += deltaX * 0.5; // Adjust the multiplier to control sensitivity
    this.touchStartX = pointer.x;
  }

  private handleTouchEnd = () => {
    this.jumpButtonDown = false;
  }

  private handleMobileControls() {
    // Handle jump
    if (this.jumpButtonDown && !this.jumpPressed) {
      this.jumpPressed = true;
      this.lastJumpPressTime = this.time.now;
    } else if (!this.jumpButtonDown) {
      this.jumpPressed = false;
    }

    this.handleJump();
  }

  private handleKeyboardControls() {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-this.playerSpeed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(this.playerSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Jump input handling
    if (this.cursors.up.isDown && !this.jumpPressed) {
      this.jumpPressed = true;
      this.lastJumpPressTime = this.time.now;
    }
    if (this.cursors.up.isUp) {
      this.jumpPressed = false;
    }

    this.handleJump();
  }

  private handleJump() {
    const canJump = this.player.body!.touching.down || (this.time.now - this.lastGroundedTime < this.coyoteTime);
    if ((this.jumpPressed && canJump) || (canJump && this.time.now - this.lastJumpPressTime < this.jumpBufferTime)) {
      this.player.setVelocityY(this.jumpVelocity);
      this.jumpTimer = 0;
      this.lastGroundedTime = 0; // Reset coyote time
      this.lastJumpPressTime = 0; // Reset jump buffer
    } else if (this.jumpPressed && this.jumpTimer < this.maxJumpTime) {
      // Continue to apply upward force while the jump button is held and within max jump time
      this.jumpTimer += this.game.loop.delta;
      const jumpForce = Phaser.Math.Linear(this.jumpVelocity, this.maxJumpVelocity, this.jumpTimer / this.maxJumpTime);
      this.player.setVelocityY(jumpForce);
    } else if (!this.jumpPressed && this.player.body!.velocity.y < 0) {
      // If the jump button is released while still moving upwards, reduce the upward velocity
      this.player.setVelocityY(this.player.body!.velocity.y * 0.5);
      this.jumpTimer = this.maxJumpTime; // End the jump
    }
  }
}