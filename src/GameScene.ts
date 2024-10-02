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

    // Create the initial platform for da boi to land on
    const initialPlatform = this.platforms.create(400, 500, 'safe-pad-1') as Phaser.Physics.Arcade.Sprite
    initialPlatform.setScale(this.platformScaleX, this.platformScaleY)
    initialPlatform.refreshBody()

    this.nextPlatformY = 500

    // Add some initial platforms
    for (let i = 0; i < 10; i++) {
      this.addPlatform()
    }

    // Create the player two levels above the initial platform
    const playerY = 500 - (this.platformSpacing * 2)
    this.player = this.physics.add.sprite(400, playerY, 'player')
    this.player.setScale(0.2)
    this.player.setBounce(0.1)
    this.player.setCollideWorldBounds(false)
    this.player.setDepth(10)

    // Replace the simple collider with a callback
    this.physics.add.collider(this.player, this.platforms, this.handlePlatformCollision)
    this.physics.add.collider(this.player, this.dangerPads, this.hitDangerPad)

    // Set the world bounds to be very tall
    this.physics.world.setBounds(0, -10000, 800, 20600)

    // Make the camera follow the player vertically
    this.cameras.main.startFollow(this.player, true, 0, 1)
    this.cameras.main.setDeadzone(100, 200)

    // Initialize cursors
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Add gravity to the player
    this.player.setGravityY(400) // Increased from 300 for faster falling

    // Spawn initial clouds after player is created
    for (let i = 0; i < 5; i++) {
      this.spawnCloud()
    }
  }

  update(time: number, delta: number) {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-this.playerSpeed)
      this.player.setFlipX(true)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(this.playerSpeed)
      this.player.setFlipX(false)
    } else {
      this.player.setVelocityX(0)
    }

    // Modify the jump condition for more control
    if (this.cursors.up.isDown && this.player.body!.touching.down) {
      this.player.setVelocityY(this.jumpVelocity)
      this.jumpTimer = 0 // Reset jump timer when starting a new jump
    } else if (this.cursors.up.isDown && this.jumpTimer < this.maxJumpTime) {
      // Continue to apply upward force while the up key is held and within max jump time
      this.jumpTimer += delta
      const jumpForce = Phaser.Math.Linear(this.jumpVelocity, this.maxJumpVelocity, this.jumpTimer / this.maxJumpTime)
      this.player.setVelocityY(jumpForce)
    } else if (this.cursors.up.isUp && this.player.body!.velocity.y < 0) {
      // If the up key is released while still moving upwards, reduce the upward velocity
      this.player.setVelocityY(this.player.body!.velocity.y * 0.5)
      this.jumpTimer = this.maxJumpTime // End the jump
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

    // Game over if player falls below the screen
    if (this.player.y > this.cameras.main.scrollY + 600) {
      this.scene.restart()
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
    let x1: number
    let x2: number
    let width1: number
    let width2: number

    // Ensure the new platforms are not overlapping and create a clear path
    do {
      width1 = Phaser.Math.Between(this.minPlatformWidth, this.maxPlatformWidth)
      width2 = Phaser.Math.Between(this.minPlatformWidth, this.maxPlatformWidth)
      x1 = Phaser.Math.Between(minX, 400 - width1 / 2)
      x2 = Phaser.Math.Between(400 + width2 / 2, maxX)
    } while (Math.abs(x2 - x1) < 200 || (x1 + width1 / 2 > 400 && x2 - width2 / 2 < 400))

    const y = this.nextPlatformY - this.platformSpacing
    
    // Decide if one of the platforms will be a danger pad (max one per level)
    const dangerPadIndex = Phaser.Math.Between(0, 10) > 8 ? Phaser.Math.Between(0, 1) : -1

    // Create two platforms on the same level
    this.createPlatform(x1, y, width1, dangerPadIndex === 0)
    this.createPlatform(x2, y, width2, dangerPadIndex === 1)

    this.nextPlatformY = y
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
    platform.setDepth(5) // Set platform depth to be above clouds but below player
    platform.refreshBody()
  }

  private hitDangerPad = (): void => {
    this.scene.restart()
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