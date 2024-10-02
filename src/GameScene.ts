import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private dangerPads!: Phaser.Physics.Arcade.StaticGroup
  private background!: Phaser.GameObjects.TileSprite
  private playerSpeed: number = 300
  private jumpVelocity: number = -450 // Reduced from -700
  private maxJumpVelocity: number = -600 // New property for maximum jump velocity
  private nextPlatformY: number = 0
  private platformSpacing: number = 220 // Increased from 180
  private platformScaleX: number = 0.7
  private platformScaleY: number = 0.5 // Reduced from 0.7
  private minPlatformWidth: number = 80 // Reduced from 100
  private maxPlatformWidth: number = 400 // Increased from 300
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

  constructor() {
    super('GameScene')
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
    // Create the background
    this.background = this.add.tileSprite(400, 300, 800, 600, 'background')
    this.background.setScrollFactor(0)
    this.background.setDepth(-1)

    // Create a group for clouds
    this.clouds = this.add.group()

    this.platforms = this.physics.add.staticGroup()
    this.dangerPads = this.physics.add.staticGroup()

    // Create the initial safe platform
    const initialPlatform = this.platforms.create(400, 550, 'safe-pad-1') as Phaser.Physics.Arcade.Sprite
    initialPlatform.setScale(this.platformScaleX, this.platformScaleY)
    initialPlatform.refreshBody()

    this.nextPlatformY = 550

    // Create the player half a level above the initial platform
    const playerY = 550 - (this.platformSpacing / 2)
    this.player = this.physics.add.sprite(400, playerY, 'player')
    this.player.setScale(0.2)
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

    // Set the world bounds to be very tall
    this.physics.world.setBounds(0, -10000, 800, 20600)

    // Make the camera follow the player vertically
    this.cameras.main.startFollow(this.player, true, 0, 1)
    this.cameras.main.setDeadzone(100, 200)
    
    // Set the camera bounds
    this.cameras.main.setBounds(0, -10000, 800, 20600)

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
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    // Apply camera offset after 10 seconds
    if (time - this.gameStartTime > 10000 && this.cameras.main.followOffset.y === 0) {
      this.cameras.main.setFollowOffset(0, 200);
    }

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-this.playerSpeed)
      this.player.setFlipX(true)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(this.playerSpeed)
      this.player.setFlipX(false)
    } else {
      this.player.setVelocityX(0)
    }

    // Update last grounded time
    if (this.player.body!.touching.down) {
      this.lastGroundedTime = time;
    }

    // Modify the jump condition to include coyote time
    if (this.cursors.up.isDown && (time - this.lastGroundedTime < this.coyoteTime)) {
      if (this.player.body!.velocity.y >= 0) { // Only jump if not already jumping
        this.player.setVelocityY(this.jumpVelocity);
        this.jumpTimer = 0; // Reset jump timer when starting a new jump
      }
    } else if (this.cursors.up.isDown && this.jumpTimer < this.maxJumpTime) {
      // Continue to apply upward force while the up key is held and within max jump time
      this.jumpTimer += delta;
      const jumpForce = Phaser.Math.Linear(this.jumpVelocity, this.maxJumpVelocity, this.jumpTimer / this.maxJumpTime);
      this.player.setVelocityY(jumpForce);
    } else if (this.cursors.up.isUp && this.player.body!.velocity.y < 0) {
      // If the up key is released while still moving upwards, reduce the upward velocity
      this.player.setVelocityY(this.player.body!.velocity.y * 0.5);
      this.jumpTimer = this.maxJumpTime; // End the jump
    }

    // Add new platforms as the player moves up
    while (this.player.y < this.nextPlatformY + 600) {
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

    // Game over if player falls below the camera view
    if (this.player.y > this.cameras.main.scrollY + this.cameras.main.height) {
      this.playerFell()
      return;
    }

    // Update the background position
    this.background.tilePositionY = this.cameras.main.scrollY
  }

  private handlePlatformCollision = (player: Phaser.Types.Physics.Arcade.GameObjectWithBody, platform: Phaser.Types.Physics.Arcade.GameObjectWithBody) => {
    const playerBody = player.body as Phaser.Physics.Arcade.Body
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody

    if (playerBody.touching.down && playerBody.bottom <= platformBody.top + 5) {
      // Player is on top of the platform
      playerBody.velocity.y = Math.max(0, playerBody.velocity.y)
    } else {
      // Player hit the platform from below or the side
      if (playerBody.touching.up) {
        playerBody.velocity.y = Math.abs(playerBody.velocity.y)
      }
      if (playerBody.touching.left || playerBody.touching.right) {
        playerBody.velocity.x = 0
      }
    }
  }

  private addPlatform() {
    const minX = this.minPlatformWidth / 2
    const maxX = 800 - this.minPlatformWidth / 2
    const middleX = 400

    // Define platform sizes
    const shortWidth = Phaser.Math.Between(this.minPlatformWidth, 150)
    const mediumWidth = Phaser.Math.Between(151, 250)
    const longWidth = Phaser.Math.Between(251, this.maxPlatformWidth)

    // Randomly choose platform combination
    const combination = Phaser.Math.Between(0, 2)
    let width1: number, width2: number

    switch (combination) {
      case 0: // Short and Medium
        width1 = shortWidth
        width2 = mediumWidth
        break
      case 1: // Short and Long
        width1 = shortWidth
        width2 = longWidth
        break
      case 2: // Medium and Short
        width1 = mediumWidth
        width2 = shortWidth
        break
    }

    // Determine positions
    let x1: number, x2: number
    const isFirstWider = width1 > width2

    if (isFirstWider) {
      x1 = Phaser.Math.Between(0, 1) === 0 ? 
        Phaser.Math.Between(minX, 200) : 
        Phaser.Math.Between(600, maxX)
      x2 = x1 < middleX ? 
        Phaser.Math.Between(middleX + width2 / 2, maxX - width2 / 2) : 
        Phaser.Math.Between(minX + width2 / 2, middleX - width2 / 2)
    } else {
      x2 = Phaser.Math.Between(0, 1) === 0 ? 
        Phaser.Math.Between(minX, 200) : 
        Phaser.Math.Between(600, maxX)
      x1 = x2 < middleX ? 
        Phaser.Math.Between(middleX + width1 / 2, maxX - width1 / 2) : 
        Phaser.Math.Between(minX + width1 / 2, middleX - width1 / 2)
    }

    const y = this.nextPlatformY - this.platformSpacing
    
    // Determine if this line can have a danger pad
    const canHaveDangerPad = this.lineCounter - this.lastDangerLine >= 2

    // 50% chance for a danger pad if allowed
    const isDangerPad = canHaveDangerPad && Phaser.Math.Between(0, 1) === 0

    if (isDangerPad) {
      // If we have a danger pad, the other one must be safe
      const dangerSide = Phaser.Math.Between(0, 1)
      this.createPlatform(dangerSide === 0 ? x1 : x2, y, dangerSide === 0 ? width1 : width2, true)
      this.createPlatform(dangerSide === 0 ? x2 : x1, y, dangerSide === 0 ? width2 : width1, false)
      this.lastDangerLine = this.lineCounter
    } else {
      // If no danger pad, both are safe
      this.createPlatform(x1, y, width1, false)
      this.createPlatform(x2, y, width2, false)
    }

    this.nextPlatformY = y
    this.lineCounter++
  }

  private createPlatform(x: number, y: number, width: number, isDanger: boolean): void {
    let platform: Phaser.Physics.Arcade.Sprite

    if (isDanger) {
      platform = this.dangerPads.create(x, y, 'danger-pad') as Phaser.Physics.Arcade.Sprite
    } else {
      const safePadTexture = Phaser.Math.Between(0, 1) === 0 ? 'safe-pad-1' : 'safe-pad-2'
      platform = this.platforms.create(x, y, safePadTexture) as Phaser.Physics.Arcade.Sprite
    }

    const horizontalScale = width / platform.width
    platform.setScale(horizontalScale, this.platformScaleY)
    const platformHeight = platform.height * this.platformScaleY
    platform.setSize(width, platformHeight)
    platform.setOffset((platform.width - width) / 2, (platform.height - platformHeight) / 2)
    platform.setDepth(5)
    platform.refreshBody()
  }

  private hitDangerPad = (_player: Phaser.Types.Physics.Arcade.GameObjectWithBody): void => {
    if (!this.isGameOver) {
      this.gameOver(_player as Phaser.Physics.Arcade.Sprite)
    }
  }

  private playerFell = (): void => {
    if (!this.isGameOver) {
      this.gameOver(this.player)
    }
  }

  private gameOver(player: Phaser.Physics.Arcade.Sprite): void {
    this.isGameOver = true

    // Disable player input
    if (player.body) {
      player.body.velocity.set(0, 0);
      (player.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }

    // Turn the player red
    player.setTint(0xff0000)

    // Turn the player upside down
    player.setFlipY(true)

    // Add a falling animation
    this.tweens.add({
      targets: player,
      angle: 180,
      y: this.cameras.main.scrollY + this.cameras.main.height + 100, // Fall below the screen
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        // Restart the scene after a short delay
        this.time.delayedCall(500, () => {
          this.scene.restart()
        })
      }
    })
  }

  private spawnCloud() {
    const x = Phaser.Math.Between(0, 800)
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
}