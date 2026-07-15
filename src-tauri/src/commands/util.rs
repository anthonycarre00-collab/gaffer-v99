use ofm_core::game::Game;
use ofm_core::state::StateManager;

const NO_ACTIVE_GAME: &str = "be.error.noActiveGameSession";

/// P0-4: Cap messages and news arrays sent to the frontend.
///
/// See `cap_messages_and_news` in commands/game.rs for full documentation.
/// This is duplicated here to avoid a circular dependency between
/// commands::util and commands::game.
fn cap_messages_and_news(game: &mut Game) {
    const MAX_MESSAGES: usize = 100;
    const MAX_NEWS: usize = 200;

    if game.messages.len() > MAX_MESSAGES {
        let start = game.messages.len() - MAX_MESSAGES;
        game.messages = game.messages[start..].to_vec();
    }
    if game.news.len() > MAX_NEWS {
        let start = game.news.len() - MAX_NEWS;
        game.news = game.news[start..].to_vec();
    }
}

/// Mutate the active game in place and return a single clone for the response.
///
/// Replaces the pervasive `get_game(|g| g.clone())` → mutate → `set_game(clone)`
/// pattern, which deep-cloned the entire world (440 teams, ~9,680 players)
/// *twice* per command. Here the world is borrowed and mutated in place, then
/// cloned once for serialization back to the UI.
///
/// The closure performs validation **before** mutation: because it mutates the
/// live game rather than a throwaway clone, any change made before it returns
/// `Err` would persist. Existing callers already validate up front.
///
/// P0-4: Messages and news are capped before returning to the frontend
/// to prevent IPC serialization overhead and frontend performance issues.
pub fn mutate_active_game<F>(state: &StateManager, mutate: F) -> Result<Game, String>
where
    F: FnOnce(&mut Game) -> Result<(), String>,
{
    state
        .update_game(|game| {
            mutate(game)?;
            cap_messages_and_news(game);
            Ok(game.clone())
        })
        .unwrap_or_else(|| Err(NO_ACTIVE_GAME.to_string()))
}
