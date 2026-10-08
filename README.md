# Relatórios APSA

Aplicação local para ler uma resposta do Google Forms em PDF, revisar ou completar os dados dos funcionários e gerar um relatório PDF.

## Como usar

1. Inicie o servidor na pasta do projeto com `python server.py` (ou `py server.py` no Windows).
2. Abra `http://127.0.0.1:8765` em um navegador moderno com acesso à internet.
3. Selecione o PDF da resposta de um cliente e clique em **Extrair resposta**.
4. Confira o CNPJ, nome fantasia, mês, funcionários, horas extras e valor unitário da hora extra. A leitura automática pode precisar de correções.
5. Use **Adicionar funcionário** para cadastrar qualquer funcionário que ficou de fora. Preencha o nome, as horas extras e o valor unitário da hora extra.
6. Clique em **Gerar relatório PDF**. O servidor salva o relatório em `destino/`. A exportação exige abrir a aplicação pelo endereço local; abrir `index.html` diretamente não salva o arquivo na pasta do projeto.

## Formato esperado no Google Forms

O modelo `modelo_resposta_formulario.pdf` incluído no projeto usa uma tabela com as colunas **Nome do Funcionário**, **Horas Extras Trabalhadas** e **Valor da Hora Extra (R$)**. A aplicação lê as linhas preenchidas dessa tabela, converte horas no formato `12h 30m` para horas decimais e ignora linhas de exemplo/placeholders. No próprio modelo, CNPJ, nome fantasia e mês são campos de exemplo a preencher; se estiverem vazios, complete-os manualmente após a extração. Um CNPJ com 14 dígitos é preservado para conferência mesmo que seus dígitos verificadores não confiram; a aplicação exibe um aviso, mas não corrige nem descarta o número.

Para respostas do Google Forms organizadas como perguntas e respostas, use estes títulos:

- `CNPJ`
- `Nome fantasia`
- `Mês de referência`
- `Funcionários`

No campo de resposta longa **Funcionários**, informe um funcionário por linha no formato `Nome; horas extras; valor da hora extra`. Exemplo: `Maria da Silva; 7,5; 32,50`. Separe os valores com ponto e vírgula e informe o valor final da hora extra, já incluindo os adicionais aplicáveis. Depois da extração, os campos ficam editáveis e funcionários podem ser adicionados ou removidos manualmente.

## Relatório

O relatório gerado é um PDF novo; não inclui nem modifica a resposta original do Forms ou uma folha de ponto. Ele contém o CNPJ, nome fantasia, mês de referência, cada funcionário, horas extras, valor unitário da hora extra e total calculado por funcionário (horas × valor unitário). A conferência humana continua necessária antes de usar os dados para pagamento.

## Privacidade e limitações

PDF.js, Tesseract.js e jsPDF são carregados de CDNs públicos, portanto é necessária conexão à internet. PDFs com texto embutido são extraídos diretamente; PDFs digitalizados usam OCR em português no navegador. Os documentos não são enviados a um modelo de IA nem ao servidor local para leitura. O servidor atende somente em `127.0.0.1` e recebe o PDF final para salvá-lo em `destino/`.

O OCR pode interpretar incorretamente CNPJ, nomes, horas ou valores. Sempre revise os campos com o PDF do Forms antes de gerar o relatório. Os relatórios contêm dados pessoais e devem ficar em local de acesso restrito; não inclua documentos reais no repositório Git.
