use keyring::{Entry, Error};

const SERVICE: &str = "dev.forgeops.desktop";

fn entry(id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn token_get(id: String) -> Result<Option<String>, String> {
    match entry(&id)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn token_set(id: String, token: String) -> Result<(), String> {
    entry(&id)?
        .set_password(&token)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn token_delete(id: String) -> Result<(), String> {
    match entry(&id)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}
