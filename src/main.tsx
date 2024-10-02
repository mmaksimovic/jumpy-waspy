import Phaser from 'phaser'
import { GameScene } from './GameScene.js'  // Add .js extension

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 }, // Add x: 0 to satisfy the Vector2Like type
      debug: false
    }
  },
  scene: [GameScene]
}

new Phaser.Game(config)
