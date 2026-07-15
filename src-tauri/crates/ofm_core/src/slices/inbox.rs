use crate::game::Game;
use domain::message::InboxMessage;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct MessagesQuery {}

/// Return messages, capped to the 500 most recent to prevent frontend
/// performance issues. The inbox UI paginates client-side.
pub fn query_messages(game: &Game, _query: &MessagesQuery) -> Vec<InboxMessage> {
    let max = 500;
    if game.messages.len() <= max {
        return game.messages.clone();
    }
    // Return the most recent N messages (messages are appended in chronological order)
    let start = game.messages.len() - max;
    game.messages[start..].to_vec()
}
