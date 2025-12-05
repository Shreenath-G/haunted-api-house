import type { GameState } from '../game/types';
import './HUD.css';

interface HUDProps {
  state: GameState;
  showDetails: boolean;
  onClose: () => void;
}

export default function HUD({ state, showDetails, onClose }: HUDProps) {
  const currentRoom = state.rooms.find(
    (r) =>
      r.position.x === Math.floor(state.player.position.x) &&
      r.position.y === Math.floor(state.player.position.y)
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Top Stats Bar */}
      <div className="stats-bar">
        <div className="stat lives">
          {'❤️'.repeat(state.player.lives)}
          {'🖤'.repeat(3 - state.player.lives)}
        </div>
        <div className="stat score">🏆 {state.score.toLocaleString()}</div>
        <div className="stat urns">
          🏺 {state.player.urnPieces}/{state.rooms.length}
        </div>
        <div className="stat time">⏱️ {formatTime(state.timeElapsed)}</div>
        {state.player.combo > 1 && (
          <div className="stat combo">🔥 {state.player.combo}x</div>
        )}
        {state.player.powerUp && (
          <div className={`stat powerup powerup-${state.player.powerUp}`}>
            {state.player.powerUp === 'speed' && '⚡'}
            {state.player.powerUp === 'shield' && '🛡️'}
            {state.player.powerUp === 'freeze' && '❄️'}
            {state.player.powerUp === 'reveal' && '👁️'}
          </div>
        )}
      </div>

      {/* Game Message */}
      {state.message && (
        <div className="game-message">
          <span>{state.message}</span>
        </div>
      )}

      {/* Difficulty Indicator */}
      {state.difficulty > 1 && (
        <div className="difficulty-badge">
          ⚠️ Difficulty: {state.difficulty.toFixed(1)}x
        </div>
      )}

      {showDetails && (
        <div className="hud-overlay">
          <div className="hud-panel">
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>

            <h2>🔦 FLASHLIGHT INSPECTION</h2>

            {currentRoom ? (
              <>
                <div className="endpoint-info">
                  <h3>{currentRoom.endpoint.name}</h3>
                  <div
                    className={`method-badge method-${currentRoom.endpoint.method.toLowerCase()}`}
                  >
                    {currentRoom.endpoint.method}
                  </div>
                  <p className="url">{currentRoom.endpoint.url}</p>
                  {currentRoom.endpoint.description && (
                    <p className="description">{currentRoom.endpoint.description}</p>
                  )}
                </div>

                {currentRoom.visited && state.lastResponse && (
                  <div className="response-info">
                    <h4>✅ Last Response</h4>
                    <div className="status-line">
                      <span
                        className={`status-code status-${Math.floor(state.lastResponse.status / 100)}xx`}
                      >
                        {state.lastResponse.status}
                      </span>
                      <span>{state.lastResponse.statusText}</span>
                      <span className="duration">{state.lastResponse.duration}ms</span>
                    </div>
                    <div className="response-body">
                      <pre>{JSON.stringify(state.lastResponse.data, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {currentRoom.monster && (
                  <div className="error-info">
                    <h4>👻 Monster Detected!</h4>
                    <p className="error-message">
                      {currentRoom.monster.type.toUpperCase()} - Error{' '}
                      {currentRoom.monster.errorCode}
                    </p>
                    {state.lastError && (
                      <p className="error-detail">{state.lastError.message}</p>
                    )}
                  </div>
                )}

                {!currentRoom.visited && (
                  <div className="hint">
                    <p>💡 Stand in the room center to make the API request</p>
                  </div>
                )}
              </>
            ) : (
              <div className="hint">
                <p>🚶 You're in a hallway. Move to a room to inspect an endpoint!</p>
                <p style={{ marginTop: '15px', fontSize: '14px', color: '#909090' }}>
                  Rooms tested: {state.player.urnPieces}/{state.rooms.length}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {state.currentRequest?.loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>MAKING REQUEST...</p>
        </div>
      )}
    </>
  );
}
