import { ATARI_COLORS, MONSTER_COLORS } from '../utils/colors';
import type { GameState, Monster } from '../game/types';
import { TILE_SIZE, PLAYER_SIZE, MONSTER_SIZE } from '../game/types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private cameraX = 0;
  private cameraY = 0;
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;

    // Disable image smoothing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
  }

  render(state: GameState): void {
    this.frameCount++;

    // Center camera on player
    this.cameraX = state.player.position.x * TILE_SIZE - this.width / 2;
    this.cameraY = state.player.position.y * TILE_SIZE - this.height / 2;

    // Clear screen - different color based on flashlight
    if (state.player.flashlightOn) {
      this.ctx.fillStyle = '#1a1a2e'; // Lighter when flashlight on
    } else {
      this.ctx.fillStyle = '#050508'; // Very dark when off
    }
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Render based on flashlight state
    if (state.player.flashlightOn) {
      this.renderWithLight(state);
    } else {
      this.renderInDarkness(state);
    }

    // Add atmospheric effects
    this.renderAtmosphere(state);

    // Flashlight indicator on screen
    this.renderFlashlightIndicator(state.player.flashlightOn);
  }

  private renderInDarkness(state: GameState): void {
    const { player, rooms, mansion } = state;
    const baseVisionRadius = 2.0; // Smaller vision in darkness
    // Pulsing vision effect
    const pulse = Math.sin(this.frameCount * 0.05) * 0.2;
    const visionRadius = baseVisionRadius + pulse;

    // Render tiles with very limited vision
    for (let y = 0; y < mansion.height; y++) {
      for (let x = 0; x < mansion.width; x++) {
        const dx = x - player.position.x;
        const dy = y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= visionRadius + 0.5) {
          const screenX = x * TILE_SIZE - this.cameraX;
          const screenY = y * TILE_SIZE - this.cameraY;

          // Sharp fade based on distance - very dark at edges
          const alpha = Math.max(0, Math.pow(1 - distance / (visionRadius + 0.5), 2));

          if (mansion.layout[y]?.[x] === 1) {
            // Wall - very dark purple
            this.ctx.fillStyle = this.withAlpha('#151525', alpha * 0.8);
            this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            // Faint wall border
            this.ctx.strokeStyle = this.withAlpha('#252540', alpha * 0.4);
            this.ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else if (mansion.layout[y]?.[x] === 0) {
            // Floor - barely visible
            this.ctx.fillStyle = this.withAlpha('#0a0a10', alpha * 0.4);
            this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          }

          // Room markers (endpoints) - faint glow
          const room = rooms.find((r) => r.position.x === x && r.position.y === y);
          if (room) {
            if (room.hasUrnPiece && !room.visited) {
              // Dim glowing urn piece
              const glow = Math.sin(this.frameCount * 0.1) * 0.2 + 0.5;
              this.ctx.fillStyle = this.withAlpha('#aa8800', alpha * glow);
              this.ctx.beginPath();
              this.ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, 6, 0, Math.PI * 2);
              this.ctx.fill();
            } else if (room.visited) {
              // Very faint visited marker
              this.ctx.fillStyle = this.withAlpha('#1a2a1a', alpha * 0.4);
              this.ctx.fillRect(screenX + 8, screenY + 8, 16, 16);
            }
          }
        }
      }
    }

    // Render monsters - they glow eerily in the dark!
    rooms.forEach((room) => {
      if (room.monster?.active) {
        const dx = room.monster.position.x - player.position.x;
        const dy = room.monster.position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Monsters visible beyond normal vision (scary!)
        if (distance <= visionRadius + 3) {
          const alpha = Math.max(0.2, 1 - distance / (visionRadius + 3));
          this.renderMonster(room.monster, alpha);
        }
      }
    });

    // Render player (always fully visible - they're your eyes!)
    this.renderPlayer(player, state.player.invincible);

    // Heavy vignette for spooky darkness
    this.renderVignette(0.9);
  }

  private renderWithLight(state: GameState): void {
    const { mansion, rooms, player } = state;
    const lightRadius = 10; // Much larger radius when flashlight is on

    // Bright flashlight glow in center
    const centerX = player.position.x * TILE_SIZE - this.cameraX + TILE_SIZE / 2;
    const centerY = player.position.y * TILE_SIZE - this.cameraY + TILE_SIZE / 2;
    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 150, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Render all visible tiles - MUCH brighter
    for (let y = 0; y < mansion.height; y++) {
      for (let x = 0; x < mansion.width; x++) {
        const screenX = x * TILE_SIZE - this.cameraX;
        const screenY = y * TILE_SIZE - this.cameraY;

        // Skip if off screen
        if (screenX < -TILE_SIZE || screenX > this.width || screenY < -TILE_SIZE || screenY > this.height) {
          continue;
        }

        const dx = x - player.position.x;
        const dy = y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0.4, 1 - distance / lightRadius);

        if (mansion.layout[y]?.[x] === 1) {
          // Wall - BRIGHT purple/blue with flashlight
          this.ctx.fillStyle = this.withAlpha('#6060a0', alpha);
          this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          this.ctx.strokeStyle = this.withAlpha('#8080c0', alpha);
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        } else if (mansion.layout[y]?.[x] === 0) {
          // Floor - visible gray
          this.ctx.fillStyle = this.withAlpha('#2a2a3a', alpha * 0.8);
          this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          // Floor grid lines
          this.ctx.strokeStyle = this.withAlpha('#3a3a4a', alpha * 0.3);
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        // Room markers
        const room = rooms.find((r) => r.position.x === x && r.position.y === y);
        if (room) {
          if (room.hasUrnPiece && !room.visited) {
            // BRIGHT glowing urn piece
            this.ctx.fillStyle = this.withAlpha('#ffff00', alpha);
            this.ctx.beginPath();
            this.ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, 12, 0, Math.PI * 2);
            this.ctx.fill();
            // Glow
            this.ctx.fillStyle = this.withAlpha('#ffaa00', alpha * 0.5);
            this.ctx.beginPath();
            this.ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, 18, 0, Math.PI * 2);
            this.ctx.fill();
          } else if (room.visited && !room.monster) {
            // Completed room - green checkmark
            this.ctx.fillStyle = this.withAlpha('#00ff00', alpha * 0.8);
            this.ctx.fillRect(screenX + 4, screenY + 4, 24, 24);
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.fillText('✓', screenX + 9, screenY + 22);
          }
        }
      }
    }

    // Render monsters (fully visible with flashlight)
    rooms.forEach((room) => {
      if (room.monster?.active) {
        this.renderMonster(room.monster, 1);
      }
    });

    // Render player
    this.renderPlayer(player, state.player.invincible);

    // Very light vignette
    this.renderVignette(0.2);
  }

  private renderPlayer(player: { position: { x: number; y: number }; flashlightOn: boolean }, invincible: boolean): void {
    const screenX = player.position.x * TILE_SIZE - this.cameraX;
    const screenY = player.position.y * TILE_SIZE - this.cameraY;

    // Invincibility flash
    if (invincible && this.frameCount % 10 < 5) {
      return; // Blink effect
    }

    // Player glow
    const glowSize = 20 + Math.sin(this.frameCount * 0.1) * 3;
    const gradient = this.ctx.createRadialGradient(
      screenX + TILE_SIZE / 2,
      screenY + TILE_SIZE / 2,
      0,
      screenX + TILE_SIZE / 2,
      screenY + TILE_SIZE / 2,
      glowSize
    );
    gradient.addColorStop(0, 'rgba(88, 248, 152, 0.4)');
    gradient.addColorStop(1, 'rgba(88, 248, 152, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(screenX - 10, screenY - 10, TILE_SIZE + 20, TILE_SIZE + 20);

    // Draw eyes (the player character)
    this.ctx.fillStyle = ATARI_COLORS.BRIGHT_GREEN;
    const eyeSize = PLAYER_SIZE / 3;
    const eyeOffset = PLAYER_SIZE / 4;

    // Left eye
    this.ctx.beginPath();
    this.ctx.arc(screenX + TILE_SIZE / 2 - eyeOffset, screenY + TILE_SIZE / 2, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Right eye
    this.ctx.beginPath();
    this.ctx.arc(screenX + TILE_SIZE / 2 + eyeOffset, screenY + TILE_SIZE / 2, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Pupils
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(screenX + TILE_SIZE / 2 - eyeOffset, screenY + TILE_SIZE / 2, eyeSize / 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(screenX + TILE_SIZE / 2 + eyeOffset, screenY + TILE_SIZE / 2, eyeSize / 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderMonster(monster: Monster, alpha: number): void {
    const screenX = monster.position.x * TILE_SIZE - this.cameraX;
    const screenY = monster.position.y * TILE_SIZE - this.cameraY;

    const color = MONSTER_COLORS[monster.errorCode as keyof typeof MONSTER_COLORS] || ATARI_COLORS.RED;

    // Monster glow (spooky!)
    const glowColor = this.withAlpha(color, alpha * 0.3);
    const gradient = this.ctx.createRadialGradient(
      screenX + TILE_SIZE / 2,
      screenY + TILE_SIZE / 2,
      0,
      screenX + TILE_SIZE / 2,
      screenY + TILE_SIZE / 2,
      MONSTER_SIZE
    );
    gradient.addColorStop(0, glowColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(screenX - 8, screenY - 8, TILE_SIZE + 16, TILE_SIZE + 16);

    this.ctx.fillStyle = this.withAlpha(color, alpha);

    // Animated wobble
    const wobble = Math.sin(this.frameCount * 0.15 + monster.position.x) * 2;

    switch (monster.type) {
      case 'ghost':
        // Wavy ghost shape
        this.ctx.beginPath();
        this.ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 + wobble, MONSTER_SIZE / 2, 0, Math.PI * 2);
        this.ctx.fill();
        // Ghost eyes
        this.ctx.fillStyle = this.withAlpha('#000000', alpha);
        this.ctx.beginPath();
        this.ctx.arc(screenX + TILE_SIZE / 2 - 4, screenY + TILE_SIZE / 2 - 2 + wobble, 3, 0, Math.PI * 2);
        this.ctx.arc(screenX + TILE_SIZE / 2 + 4, screenY + TILE_SIZE / 2 - 2 + wobble, 3, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case 'demon':
        // Angular demon with horns
        this.ctx.fillRect(screenX + 6, screenY + 8 + wobble, MONSTER_SIZE - 4, MONSTER_SIZE - 4);
        // Horns
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + 8, screenY + 8 + wobble);
        this.ctx.lineTo(screenX + 4, screenY + wobble);
        this.ctx.lineTo(screenX + 12, screenY + 8 + wobble);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + 20, screenY + 8 + wobble);
        this.ctx.lineTo(screenX + 28, screenY + wobble);
        this.ctx.lineTo(screenX + 24, screenY + 8 + wobble);
        this.ctx.fill();
        break;
      case 'zombie':
        // Shambling rectangle with arms
        this.ctx.fillRect(screenX + 10, screenY + 6 + Math.abs(wobble), MONSTER_SIZE - 8, MONSTER_SIZE);
        this.ctx.fillRect(screenX + 4, screenY + 12, 6, 10);
        this.ctx.fillRect(screenX + 22, screenY + 12, 6, 10);
        break;
      case 'vampire':
        // Triangle with cape
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + TILE_SIZE / 2, screenY + 4 + wobble);
        this.ctx.lineTo(screenX + 4, screenY + TILE_SIZE - 4);
        this.ctx.lineTo(screenX + TILE_SIZE - 4, screenY + TILE_SIZE - 4);
        this.ctx.closePath();
        this.ctx.fill();
        break;
      case 'wraith':
        // Fading ethereal shape
        this.ctx.globalAlpha = 0.5 + Math.sin(this.frameCount * 0.1) * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 + wobble, MONSTER_SIZE / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        break;
    }

    // Error code label
    this.ctx.fillStyle = this.withAlpha('#ffffff', alpha * 0.8);
    this.ctx.font = '10px monospace';
    this.ctx.fillText(String(monster.errorCode), screenX + 6, screenY + TILE_SIZE + 10);
  }

  private renderFlashlightBeam(player: { position: { x: number; y: number } }): void {
    const centerX = player.position.x * TILE_SIZE - this.cameraX + TILE_SIZE / 2;
    const centerY = player.position.y * TILE_SIZE - this.cameraY + TILE_SIZE / 2;

    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.15)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 150, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private renderVignette(intensity: number): void {
    const gradient = this.ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height / 4,
      this.width / 2,
      this.height / 2,
      this.height
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private renderAtmosphere(state: GameState): void {
    // Floating particles (dust/spirits)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 20; i++) {
      const x = ((this.frameCount * 0.5 + i * 100) % (this.width + 50)) - 25;
      const y = ((Math.sin(this.frameCount * 0.02 + i) * 50 + i * 30) % this.height);
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Frozen effect overlay
    if (state.monstersFrozen) {
      this.ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private renderFlashlightIndicator(isOn: boolean): void {
    // Show flashlight status in corner
    this.ctx.fillStyle = isOn ? '#ffff00' : '#333333';
    this.ctx.font = 'bold 14px monospace';
    this.ctx.fillText(isOn ? '🔦 FLASHLIGHT ON' : '🔦 OFF', this.width - 140, this.height - 15);
  }

  private withAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
    return color;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
