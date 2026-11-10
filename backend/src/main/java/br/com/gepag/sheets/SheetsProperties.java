package br.com.gepag.sheets;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Integração opcional com o Google Sheets via service account.
 * Para ligar: crie a service account, baixe o JSON da chave, compartilhe a planilha com o e-mail
 * dela (como editor) e preencha estas propriedades.
 */
@ConfigurationProperties(prefix = "app.sheets")
public class SheetsProperties {

    private boolean enabled = false;
    private String spreadsheetId;
    private String credentialsPath = "credentials.json";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSpreadsheetId() {
        return spreadsheetId;
    }

    public void setSpreadsheetId(String spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
    }

    public String getCredentialsPath() {
        return credentialsPath;
    }

    public void setCredentialsPath(String credentialsPath) {
        this.credentialsPath = credentialsPath;
    }
}
