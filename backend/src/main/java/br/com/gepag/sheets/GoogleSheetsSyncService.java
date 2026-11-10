package br.com.gepag.sheets;

import br.com.gepag.service.RegraNegocioException;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import com.google.api.services.sheets.v4.model.AddSheetRequest;
import com.google.api.services.sheets.v4.model.BatchUpdateSpreadsheetRequest;
import com.google.api.services.sheets.v4.model.ClearValuesRequest;
import com.google.api.services.sheets.v4.model.Request;
import com.google.api.services.sheets.v4.model.SheetProperties;
import com.google.api.services.sheets.v4.model.Spreadsheet;
import com.google.api.services.sheets.v4.model.ValueRange;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.GeneralSecurityException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Envia a planilha de acompanhamento ao Google Sheets, sobrescrevendo as abas de mesmo nome
 * (valores, sem fórmulas). O banco local continua sendo a fonte dos dados.
 */
@Service
public class GoogleSheetsSyncService {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final SheetsProperties props;

    public GoogleSheetsSyncService(SheetsProperties props) {
        this.props = props;
    }

    public record Status(boolean habilitado, boolean configurado, String spreadsheetId) {
    }

    public Status status() {
        boolean configurado = props.getSpreadsheetId() != null && !props.getSpreadsheetId().isBlank();
        return new Status(props.isEnabled(), configurado, props.getSpreadsheetId());
    }

    public void enviar(Workbook wb) {
        Sheets api = cliente();
        try {
            Spreadsheet planilha = api.spreadsheets().get(props.getSpreadsheetId()).execute();
            Set<String> existentes = planilha.getSheets().stream().map(s -> s.getProperties().getTitle()).collect(Collectors.toSet());
            List<Request> novasAbas = new ArrayList<>();
            for (Sheet s : wb) {
                if (!existentes.contains(s.getSheetName())) {
                    novasAbas.add(new Request().setAddSheet(new AddSheetRequest().setProperties(new SheetProperties().setTitle(s.getSheetName()))));
                }
            }
            if (!novasAbas.isEmpty()) {
                api.spreadsheets().batchUpdate(props.getSpreadsheetId(), new BatchUpdateSpreadsheetRequest().setRequests(novasAbas)).execute();
            }
            DataFormatter formatador = new DataFormatter();
            for (Sheet s : wb) {
                String faixa = "'" + s.getSheetName() + "'";
                List<List<Object>> linhas = new ArrayList<>();
                for (Row row : s) {
                    List<Object> linha = new ArrayList<>();
                    for (int c = 0; c < row.getLastCellNum(); c++) {
                        linha.add(valorParaSheets(row.getCell(c), formatador));
                    }
                    linhas.add(linha);
                }
                api.spreadsheets().values().clear(props.getSpreadsheetId(), faixa, new ClearValuesRequest()).execute();
                api.spreadsheets().values().update(props.getSpreadsheetId(), faixa + "!A1", new ValueRange().setValues(linhas))
                        .setValueInputOption("USER_ENTERED").execute();
            }
        } catch (IOException e) {
            throw new RegraNegocioException("Falha ao enviar para o Google Sheets: " + e.getMessage(), e);
        }
    }

    private static Object valorParaSheets(Cell cell, DataFormatter formatador) {
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(cell)) {
                var dt = cell.getLocalDateTimeCellValue();
                return dt.toLocalTime().equals(java.time.LocalTime.MIDNIGHT) ? dt.format(DATA) : dt.format(DATA_HORA);
            }
            return cell.getNumericCellValue();
        }
        return formatador.formatCellValue(cell);
    }

    private Sheets cliente() {
        Status s = status();
        if (!s.habilitado()) {
            throw new RegraNegocioException("A integração com o Google Sheets está desligada. Ative app.sheets.enabled no application.yml.");
        }
        if (!s.configurado()) {
            throw new RegraNegocioException("Informe o ID da planilha em app.sheets.spreadsheet-id no application.yml.");
        }
        try (InputStream chave = new FileInputStream(props.getCredentialsPath())) {
            GoogleCredentials credenciais = GoogleCredentials.fromStream(chave).createScoped(List.of(SheetsScopes.SPREADSHEETS));
            return new Sheets.Builder(GoogleNetHttpTransport.newTrustedTransport(), GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credenciais)).setApplicationName("Monitoramento GEPAG").build();
        } catch (IOException e) {
            throw new RegraNegocioException("Não encontrei a chave da service account em \"" + props.getCredentialsPath() + "\".", e);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
