import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiCollection } from '../api/types';
import type { GameState, PowerUp } from '../game/types';
import {
  generateMansion,
  isWall,
  getRoomAt,
  getMonsterType,
} from '../game/mansion';
import { apiClient } from '../api/client';
import { audioEngine } from '../engine/audio';

const COMBO_TIMEOUT = 3000; // 3 seconds to maintain combo
const INVINCIBILITY_DURATION = 2000; // 2 seconds after hit
const POWERUP_DURATION = 5000; // 5 seconds for power-ups
const FREEZE_DURATION = 3000; // 3 seconds freeze

export function useGameState(collection: ApiCollection) {
  const [state, setState] = useState<GameState>(() => {
    const mansion = generateMansion(collection.endpoints);

    return {
      player: {
        position: {
          x: mansion.rooms[0].position.x,
          y: mansion.rooms[0].position.y,
        },
        velocity: { x: 0, y: 0 },
        currentRoom: null,
        urnPieces: 0,
        flashlightOn: false,
        lives: 3,
        invincible: false,
        invincibleUntil: 0,
        powerUp: null,
        combo: 0,
        lastCollectTime: 0,
      },
      rooms: mansion.rooms,
      mansion: {
        width: mansion.width,
        height: mansion.height,
        layout: mansion.layout,
      },
      currentRequest: null,
      lastResponse: null,
      lastError: null,
      score: 0,
      gameOver: false,
      victory: false,
      screenShake: 0,
      monstersFrozen: false,
      freezeUntil: 0,
      difficulty: 1,
      timeElapsed: 0,
      message: '🎃 Find all the urn pieces to escape!',
      messageUntil: Date.now() + 3000,
    };
  });

  const lastMoveTime = useRef(0);
  const gameStartTime = useRef(Date.now());

  // Dynamic cooldown based on power-ups
  const getMoveCooldown = useCallback(() => {
    if (state.player.powerUp === 'speed') return 80;
    return 120;
  }, [state.player.powerUp]);

  const showMessage = useCallback((msg: string, duration = 2000) => {
    setState((prev) => ({
      ...prev,
      message: msg,
      messageUntil: Date.now() + duration,
    }));
  }, []);

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      const now = Date.now();
      const cooldown = getMoveCooldown();
      if (now - lastMoveTime.current < cooldown) {
        return;
      }

      setState((prev) => {
        if (prev.gameOver || prev.victory) return prev;

        const newX = prev.player.position.x + dx;
        const newY = prev.player.position.y + dy;

        if (isWall(prev.mansion.layout, Math.floor(newX), Math.floor(newY))) {
          return prev;
        }

        lastMoveTime.current = now;
        audioEngine.playMove();

        // Check combo timeout
        const comboActive = now - prev.player.lastCollectTime < COMBO_TIMEOUT;
        const newCombo = comboActive ? prev.player.combo : 0;

        return {
          ...prev,
          player: {
            ...prev.player,
            position: { x: newX, y: newY },
            combo: newCombo,
          },
        };
      });
    },
    [getMoveCooldown]
  );

  const toggleFlashlight = useCallback(() => {
    setState((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        flashlightOn: !prev.player.flashlightOn,
      },
    }));
    audioEngine.playFlashlight();
  }, []);

  const activatePowerUp = useCallback((powerUp: PowerUp) => {
    audioEngine.playSuccess();
    setState((prev) => {
      let newState = {
        ...prev,
        player: {
          ...prev.player,
          powerUp,
        },
      };

      if (powerUp === 'freeze') {
        newState = {
          ...newState,
          monstersFrozen: true,
          freezeUntil: Date.now() + FREEZE_DURATION,
          message: '❄️ MONSTERS FROZEN!',
          messageUntil: Date.now() + 2000,
        };
      } else if (powerUp === 'shield') {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            invincible: true,
            invincibleUntil: Date.now() + POWERUP_DURATION,
          },
          message: '🛡️ SHIELD ACTIVE!',
          messageUntil: Date.now() + 2000,
        };
      } else if (powerUp === 'speed') {
        newState = {
          ...newState,
          message: '⚡ SPEED BOOST!',
          messageUntil: Date.now() + 2000,
        };
      } else if (powerUp === 'reveal') {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            flashlightOn: true,
          },
          message: '👁️ ALL REVEALED!',
          messageUntil: Date.now() + 2000,
        };
      }

      return newState;
    });

    // Clear power-up after duration
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        player: {
          ...prev.player,
          powerUp: null,
        },
        monstersFrozen: false,
      }));
    }, POWERUP_DURATION);
  }, []);

  const takeDamage = useCallback(() => {
    setState((prev) => {
      if (prev.player.invincible || prev.player.powerUp === 'shield') {
        return prev;
      }

      const newLives = prev.player.lives - 1;
      audioEngine.playError();

      if (newLives <= 0) {
        return {
          ...prev,
          player: { ...prev.player, lives: 0 },
          gameOver: true,
          screenShake: 20,
          message: '💀 GAME OVER!',
          messageUntil: Date.now() + 5000,
        };
      }

      return {
        ...prev,
        player: {
          ...prev.player,
          lives: newLives,
          invincible: true,
          invincibleUntil: Date.now() + INVINCIBILITY_DURATION,
          combo: 0,
        },
        screenShake: 10,
        message: `💔 Ouch! ${newLives} ${newLives === 1 ? 'life' : 'lives'} left!`,
        messageUntil: Date.now() + 2000,
      };
    });
  }, []);

  const updateMonsters = useCallback(() => {
    const now = Date.now();

    setState((prev) => {
      // Clear screen shake
      const newShake = prev.screenShake > 0 ? prev.screenShake * 0.9 : 0;

      // Clear invincibility
      const stillInvincible =
        prev.player.invincible && now < prev.player.invincibleUntil;

      // Clear freeze
      const stillFrozen = prev.monstersFrozen && now < prev.freezeUntil;

      // Clear message
      const showMsg = prev.message && now < prev.messageUntil;

      // Update difficulty based on time
      const elapsed = (now - gameStartTime.current) / 1000;
      const newDifficulty = 1 + Math.floor(elapsed / 30) * 0.2; // +20% every 30s

      let playerHit = false;

      const updatedRooms = prev.rooms.map((room) => {
        if (!room.monster?.active || stillFrozen) return room;

        // Monster AI with difficulty scaling
        const dx = prev.player.position.x - room.monster.position.x;
        const dy = prev.player.position.y - room.monster.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check collision with player
        if (distance < 0.8 && !stillInvincible) {
          playerHit = true;
        }

        if (distance > 0.1) {
          const speed = room.monster.speed * newDifficulty * 0.03;
          const moveX = (dx / distance) * speed;
          const moveY = (dy / distance) * speed;

          // Add some randomness for unpredictability
          const randomX = (Math.random() - 0.5) * 0.02;
          const randomY = (Math.random() - 0.5) * 0.02;

          return {
            ...room,
            monster: {
              ...room.monster,
              position: {
                x: room.monster.position.x + moveX + randomX,
                y: room.monster.position.y + moveY + randomY,
              },
            },
          };
        }

        return room;
      });

      return {
        ...prev,
        rooms: updatedRooms,
        screenShake: newShake < 0.5 ? 0 : newShake,
        player: {
          ...prev.player,
          invincible: stillInvincible,
        },
        monstersFrozen: stillFrozen,
        difficulty: newDifficulty,
        timeElapsed: elapsed,
        message: showMsg ? prev.message : null,
        ...(playerHit && !stillInvincible
          ? (() => {
              const newLives = prev.player.lives - 1;
              if (newLives <= 0) {
                return {
                  gameOver: true,
                  player: { ...prev.player, lives: 0 },
                  screenShake: 20,
                  message: '💀 GAME OVER!',
                  messageUntil: now + 5000,
                };
              }
              return {
                player: {
                  ...prev.player,
                  lives: newLives,
                  invincible: true,
                  invincibleUntil: now + INVINCIBILITY_DURATION,
                  combo: 0,
                },
                screenShake: 10,
                message: `💔 ${newLives} ${newLives === 1 ? 'life' : 'lives'} left!`,
                messageUntil: now + 2000,
              };
            })()
          : {}),
      };
    });
  }, []);


  // Check if player is in a room and trigger API request
  useEffect(() => {
    if (state.gameOver || state.victory) return;

    const currentRoom = getRoomAt(state.rooms, {
      x: Math.floor(state.player.position.x),
      y: Math.floor(state.player.position.y),
    });

    if (currentRoom && !currentRoom.visited && !state.currentRequest) {
      audioEngine.playEnterRoom();

      setState((prev) => ({
        ...prev,
        currentRequest: {
          endpointId: currentRoom.id,
          loading: true,
        },
      }));

      apiClient
        .makeRequest(currentRoom.endpoint, collection.auth, collection.variables)
        .then(({ response, error }) => {
          setState((prev) => {
            const now = Date.now();
            const comboActive = now - prev.player.lastCollectTime < COMBO_TIMEOUT;

            const updatedRooms = prev.rooms.map((room) => {
              if (room.id === currentRoom.id) {
                if (response) {
                  audioEngine.playSuccess();
                  return {
                    ...room,
                    visited: true,
                    hasUrnPiece: false,
                  };
                } else if (error) {
                  audioEngine.playError();
                  audioEngine.playMonster();
                  const errorCode: number | 'timeout' = error.isTimeout
                    ? 'timeout'
                    : error.status || 500;

                  // Monster speed based on error severity
                  let speed = 1;
                  if (errorCode === 'timeout') speed = 0.5; // Zombies are slow
                  else if (errorCode >= 500) speed = 1.5; // Demons are fast
                  else if (errorCode === 404) speed = 1.2; // Ghosts are medium-fast

                  return {
                    ...room,
                    visited: true,
                    monster: {
                      type: getMonsterType(errorCode),
                      position: { ...room.position },
                      errorCode,
                      active: true,
                      speed: speed * prev.difficulty,
                    },
                  };
                }
              }
              return room;
            });

            if (response) {
              // Calculate score with combo multiplier
              const newCombo = comboActive ? prev.player.combo + 1 : 1;
              const comboMultiplier = Math.min(newCombo, 5); // Max 5x
              const baseScore = 100;
              const timeBonus = Math.max(0, 50 - Math.floor(prev.timeElapsed));
              const pointsEarned = (baseScore + timeBonus) * comboMultiplier;

              const urnPieces = prev.player.urnPieces + 1;
              const victory = urnPieces === prev.rooms.length;

              // Random power-up chance (20% on combo 3+)
              let powerUpMsg = '';
              if (newCombo >= 3 && Math.random() < 0.2) {
                const powerUps: PowerUp[] = ['speed', 'shield', 'freeze', 'reveal'];
                const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
                setTimeout(() => activatePowerUp(randomPowerUp), 100);
                powerUpMsg = ' + POWER-UP!';
              }

              const comboMsg =
                newCombo > 1 ? ` 🔥 ${newCombo}x COMBO!${powerUpMsg}` : '';

              return {
                ...prev,
                rooms: updatedRooms,
                player: {
                  ...prev.player,
                  urnPieces,
                  combo: newCombo,
                  lastCollectTime: now,
                },
                currentRequest: null,
                lastResponse: response,
                lastError: null,
                score: prev.score + pointsEarned,
                victory,
                message: victory
                  ? '🎉 VICTORY! You escaped!'
                  : `✨ +${pointsEarned} points!${comboMsg}`,
                messageUntil: now + 2000,
              };
            } else {
              return {
                ...prev,
                rooms: updatedRooms,
                player: {
                  ...prev.player,
                  combo: 0, // Reset combo on error
                },
                currentRequest: null,
                lastResponse: null,
                lastError: error,
                message: `⚠️ ${error?.status || 'Error'}: Monster spawned!`,
                messageUntil: now + 2000,
              };
            }
          });
        });
    }
  }, [
    state.player.position,
    state.rooms,
    state.currentRequest,
    state.gameOver,
    state.victory,
    collection,
    activatePowerUp,
  ]);

  return {
    state,
    actions: {
      movePlayer,
      toggleFlashlight,
      updateMonsters,
      takeDamage,
      activatePowerUp,
      showMessage,
    },
  };
}
