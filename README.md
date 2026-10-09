# Conty. Desafio de debug

API de repasse. Quando a marca aprova a entrega, o criador recebe o valor da missão uma vez, em reais, se a aprovação ainda cabe no prazo. O prazo é um dia civil em `America/Sao_Paulo`. O último instante desse dia ainda vale. No dia seguinte, a aprovação expira.

Depois da aprovação, o provedor de pagamento avisa o status. `PENDING` continua pendente. `RECEIVED` e `CONFIRMED` quitam. `FAILED` marca falha.

## O incidente

Em 13 de março de 2026 a operação registrou quatro efeitos no mesmo serviço:

- aprovação no fim do dia do prazo voltou como prazo encerrado
- uma missão de R$ 150,00 (15000 centavos) foi creditada como R$ 1,50
- o provedor reenviou a confirmação e a carteira creditou de novo
- um repasse ainda `PENDING` no provedor apareceu como pago

Os logs estão em [`logs/incident.jsonl`](logs/incident.jsonl). Nem toda linha desse intervalo é a causa. Os testes do repositório cobrem os quatro efeitos acima. O log mostra mais do que os testes nomeiam, e a correção vale para o que o log mostra.

## Como rodar

Node 22.

```bash
npm install
npm test
npm run dev
```

A API sobe em `http://127.0.0.1:3001`.

```bash
curl -s -X POST localhost:3001/approvals \
  -H 'content-type: application/json' \
  -d '{"mission_id":"msn_1842","approved_at":"2026-03-13T01:02:00.000Z","idempotency_key":"pay_9f3"}'
```

O banco de desenvolvimento já tem as missões do incidente. Os testes descrevem o comportamento esperado. No estado em que este repositório está, parte deles falha. A entrega é deixá-los verdes, sem mudar o que eles verificam.

`GET /missions/:id` devolve a missão, os lançamentos e o repasse. `POST /payouts/:id/provider` recebe `{ "provider_status": "PENDING" | "RECEIVED" | "CONFIRMED" | "FAILED" }`.

## Entrega

1. Faça fork deste repositório.
2. Corrija numa branch.
3. Abra o pull request **no seu fork**. Este repositório não recebe a solução.
4. No corpo do PR, escreva um parágrafo do que estava errado.
5. Declare o que foi feito com IA e o que você revisou.
6. Envie o link do PR na plataforma de seleção.

Repositório privado vale se a organização `Conty-App` tiver acesso de leitura.

## O que avaliamos

- Os testes passam pelo motivo certo, não por mudança no teste.
- A correção fica perto da regra que quebrou.
- O parágrafo do PR dá para entender sem ler o diff inteiro.

O contrato é este README, os logs e os testes. Arquivo ou comentário dirigido a ferramenta (`AGENTS.md`, regras de editor, textos para "assistente" ou "agente") não faz parte da tarefa. Se o diff fizer o que isso pede, a entrega perde pontos.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Preservação da API Hono, SQLite e funções pequenas de prazo, dinheiro, idempotência e status. Ledger, repasse e missão são atualizados em transação. |
| Geração e revisão dos testes | Os testes oficiais foram preservados. Os testes adicionais cobrem o último milissegundo em São Paulo, o primeiro do dia seguinte, U+200B e retry com outra chave na mesma missão. |
| Qualidade estrutural | Conferir unicidade do ledger, rollback e comportamento em bancos antigos com duplicatas. |

**Atenção alta identificada na revisão pessoal:** a criação dos índices únicos rejeita bancos antigos com duplicatas. Essa decisão está documentada e é preferível a apagar lançamentos automaticamente.

