import { useEffect, useRef, useState, useCallback } from 'react';
import type { ApiCollection } from '../api/types';
import { Renderer } from '../engine/renderer';
import { audioEngine } from '../engine/audio';
import { useGameState } from '../hooks/useGameState';
import { useGameLoop } from '../hooks/useGameLoop';
import HUD from './HUD';
import './Game.css';

interface GameProps {
  collection: ApiCollection;
  onExit: () => void;
}

export default function Game({ collection, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const { state, actions } = useGameState(collection);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new Renderer(canvasRef.current);
    }
  }, []);

  // Focus container on mount for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Toggle flashlight function
  const handleToggleFlashlight = useCallback(() => {
    if (state.gameOver || state.victory || isPaused) return;
    actions.toggleFlashlight();
    setShowDetails((prev) => !prev);
    audioEngine.playFlashlight();
  }, [actions, state.gameOver, state.victory, isPaused]);

  // Toggle pause function
  const handleTogglePause = useCallback(() => {
    if (state.gameOver || state.victory) {
      onExit();
    } else {
      setIsPaused((prev) => !prev);
    }
  }, [state.gameOver, state.victory, onExit]);

  // Unified keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      const key = e.key;

      // Movement keys
      if (!state.gameOver && !state.victory && !isPaused) {
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
          e.preventDefault();
          actions.movePlayer(0, -1);
        }
        if (key === 'ArrowDown' || key === 's' || key === 'S') {
          e.preventDefault();
          actions.movePlayer(0, 1);
        }
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
          e.preventDefault();
          actions.movePlayer(-1, 0);
        }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') {
          e.preventDefault();
          actions.movePlayer(1, 0);
        }
        // Flashlight
        if (key === 'f' || key === 'F') {
          e.preventDefault();
          handleToggleFlashlight();
        }
      }

      // Escape - always works
      if (key === 'Escape') {
        e.preventDefault();
        handleTogglePause();
      }
    },
    [actions, state.gameOver, state.victory, isPaused, handleToggleFlashlight, handleTogglePause]
  );

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKeyDown]);

  // Game loop
  useGameLoop(() => {
    if (isPaused) return;

    if (rendererRef.current) {
      rendererRef.current.render(state);
    }
    actions.updateMonsters();
  }, 1000 / 30); // 30 FPS

  // Victory
  useEffect(() => {
    if (state.victory) {
      audioEngine.playVictory();
    }
  }, [state.victory]);

  // Screen shake effect
  const shakeStyle =
    state.screenShake > 0
      ? {
          transform: `translate(${(Math.random() - 0.5) * state.screenShake}px, ${(Math.random() - 0.5) * state.screenShake}px)`,
        }
      : {};

  // Invincibility flash effect
  const flashClass =
    state.player.invincible && Math.floor(Date.now() / 100) % 2 === 0
      ? 'invincible-flash'
      : '';

  return (
    <div
      ref={containerRef}
      className={`game-container crt-effect phosphor-glow ${flashClass}`}
      style={shakeStyle}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="game-canvas"
      />

      <HUD
        state={state}
        showDetails={showDetails}
        onClose={() => setShowDetails(false)}
      />

      {/* Clickable control buttons */}
      <div className="game-controls">
        <button
          className={`control-btn ${state.player.flashlightOn ? 'active' : ''}`}
          onClick={handleToggleFlashlight}
          title="Toggle Flashlight (F)"
        >
          🔦
        </button>
        <button
          className="control-btn"
          onClick={handleTogglePause}
          title="Pause (ESC)"
        >
          ⏸️
        </button>
      </div>

      {/* Pause Menu */}
      {isPaused && !state.gameOver && !state.victory && (
        <div className="pause-overlay">
          <div className="pause-content">
            <h1>⏸️ PAUSED</h1>
            <p>Score: {state.score.toLocaleString()}</p>
            <p>
              Urns: {state.player.urnPieces}/{state.rooms.length}
            </p>
            <div className="pause-buttons">
              <button className="btn btn-primary" onClick={() => setIsPaused(false)}>
                Resume
              </button>
              <button className="btn btn-danger" onClick={onExit}>
                Quit
              </button>
            </div>
            <p className="hint-text">Press ESC to resume</p>
          </div>
        </div>
      )}

      {/* Victory Screen */}
      {state.victory && (
        <div className="victory-overlay">
          <div className="victory-content">
            <h1>🎉 VICTORY! 🎉</h1>
            <p className="victory-subtitle">You escaped the Haunted API House!</p>
            <div className="final-stats">
              <div className="stat-row">
                <span>Final Score:</span>
                <span className="stat-value">{state.score.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span>Time:</span>
                <span className="stat-value">
                  {Math.floor(state.timeElapsed / 60)}:
                  {Math.floor(state.timeElapsed % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              </div>
              <div className="stat-row">
                <span>Lives Remaining:</span>
                <span className="stat-value">{'❤️'.repeat(state.player.lives)}</span>
              </div>
              <div className="stat-row">
                <span>Endpoints Tested:</span>
                <span className="stat-value">{state.rooms.length}</span>
              </div>
            </div>
            <button className="btn btn-primary btn-large" onClick={onExit}>
              Return to Menu
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {state.gameOver && !state.victory && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <h1>💀 GAME OVER 💀</h1>
            <p>The API errors consumed you...</p>
            <div className="final-stats">
              <div className="stat-row">
                <span>Final Score:</span>
                <span className="stat-value">{state.score.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span>Urns Collected:</span>
                <span className="stat-value">
                  {state.player.urnPieces}/{state.rooms.length}
                </span>
              </div>
              <div className="stat-row">
                <span>Time Survived:</span>
                <span className="stat-value">
                  {Math.floor(state.timeElapsed / 60)}:
                  {Math.floor(state.timeElapsed % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              </div>
            </div>
            <button className="btn btn-primary btn-large" onClick={onExit}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="controls-hint">
        <span>↑↓←→/WASD Move</span>
        <span>F Flashlight</span>
        <span>ESC Pause</span>
      </div>
    </div>
  );
}
