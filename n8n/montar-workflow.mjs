// Gera workflows/horas-complementares.json a partir de n8n/codigo/*.js.
// O código dos Code nodes vive nos .js (legível e testável); rode de novo após editar:
//   node n8n/montar-workflow.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const codigo = (nome) => readFileSync(join(AQUI, 'codigo', `${nome}.js`), 'utf8');

const nodes = [];
const connections = {};
let seq = 0;

function no(name, type, typeVersion, position, parameters, extra = {}) {
  nodes.push({ id: `hc-${String(++seq).padStart(2, '0')}`, name, type, typeVersion, position, parameters, ...extra });
}
const code = (name, arquivo, position) =>
  no(name, 'n8n-nodes-base.code', 2, position, { jsCode: codigo(arquivo) });

function se(name, position, condicao) {
  no(name, 'n8n-nodes-base.if', 2.2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: `${name}-cond`, ...condicao }],
      combinator: 'and',
    },
    options: {},
  });
}
const semErro = { leftValue: '={{ $json.erro }}', rightValue: '', operator: { type: 'string', operation: 'empty', singleValue: true } };
const igual = (campo, valor) => ({ leftValue: `={{ $json.${campo} }}`, rightValue: valor, operator: { type: 'string', operation: 'equals' } });
const verdadeiro = (campo) => ({ leftValue: `={{ $json.${campo} }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } });

const respostaJson = { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } };
const continuar = { onError: 'continueRegularOutput' };

function postPdf(name, position, url, campo) {
  no(name, 'n8n-nodes-base.httpRequest', 4.2, position, {
    method: 'POST', url, sendBody: true, contentType: 'binaryData', inputDataFieldName: campo,
    options: { ...respostaJson, timeout: 30000 },
  }, continuar);
}

function gotenberg(name, position, rota, partes, saida) {
  no(name, 'n8n-nodes-base.httpRequest', 4.2, position, {
    method: 'POST', url: `http://gotenberg:3000${rota}`, sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: partes },
    options: { response: { response: { responseFormat: 'file', outputPropertyName: saida } }, timeout: 60000 },
  }, continuar);
}

function liga(origem, destino, saida = 0) {
  connections[origem] ??= { main: [] };
  const main = connections[origem].main;
  while (main.length <= saida) main.push([]);
  main[saida].push({ node: destino, type: 'main', index: 0 });
}

// ---- Gatilhos ---------------------------------------------------------------
const PRIVACIDADE = 'Entendo que meus dados servem só para gerar a declaração e não ficam guardados, e que o texto do certificado vai para a IA sem nome, matrícula, RG e CPF.';
// Versão 2.1: a partir da 2.2 o Form Trigger não aceita o nó Respond to Webhook, que é o que
// permite devolver a página de resultado com os dois downloads.
no('Formulário', 'n8n-nodes-base.formTrigger', 2.1, [0, 0], {
  path: 'horas-complementares',
  formTitle: 'Horas Complementares: certificado pronto para o SIGAA',
  formDescription: 'Para Eng. de Computação do CEFET-MG Leopoldina, matriz CL2023T (570 h/a). Envie o certificado e receba a categoria do SIGAA, as horas que serão abatidas e o PDF pronto (declaração assinada + certificado). A validação final é da Coordenação.',
  formFields: {
    values: [
      { fieldLabel: 'Certificado (PDF)', fieldType: 'file', acceptFileTypes: '.pdf', multipleFiles: false, requiredField: true },
      {
        fieldLabel: 'Declaração de autenticidade', fieldType: 'radio', requiredField: true,
        fieldOptions: { values: [
          { option: 'Primeira vez: vou preencher meus dados e enviar a foto da assinatura' },
          { option: 'Já tenho minha declaração-base (gerada aqui antes)' },
        ] },
      },
      { fieldType: 'html', html: '<p><strong>Primeira vez:</strong> preencha os dados e envie uma foto da sua assinatura em papel branco. A ferramenta monta a declaração e devolve uma declaração-base para você reutilizar.</p>' },
      { fieldLabel: 'Nome completo', fieldType: 'text', placeholder: 'Como está no SIGAA' },
      { fieldLabel: 'Matrícula', fieldType: 'text', placeholder: 'Só números' },
      { fieldLabel: 'RG', fieldType: 'text' },
      { fieldLabel: 'CPF', fieldType: 'text', placeholder: '000.000.000-00' },
      { fieldLabel: 'Foto da assinatura (JPG ou PNG)', fieldType: 'file', acceptFileTypes: '.jpg,.jpeg,.png', multipleFiles: false },
      { fieldType: 'html', html: '<p><strong>Já tenho a declaração-base:</strong> envie o PDF que a ferramenta gerou no seu primeiro uso. Só a data muda.</p>' },
      { fieldLabel: 'Declaração-base (PDF)', fieldType: 'file', acceptFileTypes: '.pdf', multipleFiles: false },
      { fieldLabel: 'Privacidade', fieldType: 'checkbox', requiredField: true, fieldOptions: { values: [{ option: PRIVACIDADE }] } },
    ],
  },
  responseMode: 'responseNode',
  options: { appendAttribution: false, buttonLabel: 'Gerar meu PDF' },
}, { webhookId: '6f1c2a90-5b1e-4c39-9a52-0d0c00000001' });

no('API classificar', 'n8n-nodes-base.webhook', 2.1, [0, 320], {
  httpMethod: 'POST', path: 'classificar', responseMode: 'responseNode', options: {},
}, { webhookId: '6f1c2a90-5b1e-4c39-9a52-0d0c00000002' });

// ---- Entrada e declaração ---------------------------------------------------
code('Normalizar formulário', 'normalizar-formulario', [220, 0]);
code('Normalizar API', 'normalizar-api', [220, 320]);
se('Entrada ok?', [440, 160], semErro);
se('Precisa de declaração?', [660, 100], igual('origem', 'formulario'));
se('Primeiro uso?', [880, 0], igual('modo', 'primeiro_uso'));
code('Montar declaração', 'montar-declaracao', [1100, -120]);
gotenberg('Gotenberg: HTML para PDF', [1320, -120], '/forms/chromium/convert/html', [
  { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'html' },
  { name: 'preferCssPageSize', value: 'true' },
  { name: 'printBackground', value: 'true' },
  { name: 'metadata', value: '{"Subject":"horas-complementares-ia/declaracao-base/v1"}' },
], 'declaracao_base');
code('Guardar base', 'guardar-base', [1540, -120]);
postPdf('Datar declaração', [1760, 0], 'http://declaracao:8000/redatar', 'declaracao_base');

// ---- Classificação ----------------------------------------------------------
code('Preparar certificado', 'preparar-certificado', [1980, 160]);
se('Declaração ok?', [2200, 160], semErro);
postPdf('Extrair texto', [2420, 160], 'http://declaracao:8000/texto', 'certificado');
code('Anonimizar', 'anonimizar', [2640, 160]);
se('Texto ok?', [2860, 160], semErro);
code('Montar requisição', 'montar-requisicao', [3080, 160]);
se('Sem chave do Gemini?', [3300, 160], verdadeiro('simular'));
code('Resposta simulada', 'resposta-simulada', [3520, 40]);
no('Gemini', 'n8n-nodes-base.httpRequest', 4.2, [3520, 280], {
  method: 'POST',
  url: '=https://generativelanguage.googleapis.com/v1beta/models/{{ $json.modelo }}:generateContent',
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'x-goog-api-key', value: '={{ $env.GEMINI_API_KEY }}' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.requisicao) }}',
  options: { ...respostaJson, timeout: 45000 },
}, continuar);
code('Validar e calcular', 'validar-calcular', [3740, 160]);
se('Classificação ok?', [3960, 160], semErro);
se('Veio do formulário?', [4180, 100], igual('origem', 'formulario'));

// ---- Respostas --------------------------------------------------------------
code('Preparar merge', 'preparar-merge', [4400, 0]);
gotenberg('Gotenberg: juntar PDFs', [4620, 0], '/forms/pdfengines/merge', [
  { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'declaracao' },
  { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'certificado' },
], 'pdf_final');
code('Montar página', 'montar-pagina', [4840, 0]);
code('Resposta API', 'resposta-api', [4840, 220]);
code('Formatar erro', 'formatar-erro', [4840, 460]);
no('Responder', 'n8n-nodes-base.respondToWebhook', 1.4, [5060, 220], {
  respondWith: 'text',
  responseBody: '={{ $json.resposta }}',
  options: {
    responseCode: '={{ $json.status }}',
    responseHeaders: { entries: [{ name: 'Content-Type', value: '={{ $json.content_type }}' }] },
  },
});

// ---- Ligações ---------------------------------------------------------------
liga('Formulário', 'Normalizar formulário');
liga('API classificar', 'Normalizar API');
liga('Normalizar formulário', 'Entrada ok?');
liga('Normalizar API', 'Entrada ok?');
liga('Entrada ok?', 'Precisa de declaração?', 0);
liga('Entrada ok?', 'Formatar erro', 1);
liga('Precisa de declaração?', 'Primeiro uso?', 0);
liga('Precisa de declaração?', 'Preparar certificado', 1);
liga('Primeiro uso?', 'Montar declaração', 0);
liga('Primeiro uso?', 'Datar declaração', 1);
liga('Montar declaração', 'Gotenberg: HTML para PDF');
liga('Gotenberg: HTML para PDF', 'Guardar base');
liga('Guardar base', 'Datar declaração');
liga('Datar declaração', 'Preparar certificado');
liga('Preparar certificado', 'Declaração ok?');
liga('Declaração ok?', 'Extrair texto', 0);
liga('Declaração ok?', 'Formatar erro', 1);
liga('Extrair texto', 'Anonimizar');
liga('Anonimizar', 'Texto ok?');
liga('Texto ok?', 'Montar requisição', 0);
liga('Texto ok?', 'Formatar erro', 1);
liga('Montar requisição', 'Sem chave do Gemini?');
liga('Sem chave do Gemini?', 'Resposta simulada', 0);
liga('Sem chave do Gemini?', 'Gemini', 1);
liga('Resposta simulada', 'Validar e calcular');
liga('Gemini', 'Validar e calcular');
liga('Validar e calcular', 'Classificação ok?');
liga('Classificação ok?', 'Veio do formulário?', 0);
liga('Classificação ok?', 'Formatar erro', 1);
liga('Veio do formulário?', 'Preparar merge', 0);
liga('Veio do formulário?', 'Resposta API', 1);
liga('Preparar merge', 'Gotenberg: juntar PDFs');
liga('Gotenberg: juntar PDFs', 'Montar página');
liga('Montar página', 'Responder');
liga('Resposta API', 'Responder');
liga('Formatar erro', 'Responder');

const workflow = {
  id: 'hcIaHorasCompl01',
  name: 'Horas Complementares IA',
  nodes,
  connections,
  settings: {
    executionOrder: 'v1',
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  },
  pinData: {},
  active: false,
};

writeFileSync(join(AQUI, '..', 'workflows', 'horas-complementares.json'), `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`workflow gerado: ${nodes.length} nós`);
