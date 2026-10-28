# Lilo World: plano de trabalho (v0.2)

Documento vivo para continuar o desenvolvimento em qualquer sessão. Visão e princípios do jogo: [docs/plano-jogo-autismo.md](docs/plano-jogo-autismo.md). Arquitetura: [docs/architecture.md](docs/architecture.md).

## Onde estamos

| Sprint                                                              | Status     | Commit    |
| ------------------------------------------------------------------- | ---------- | --------- |
| Protótipo 3D (ilha, cidade, missão do mercado, guarda-roupa)        | ✅ feito   | `1fa268b` |
| 1: perfis, salvamento, menu, ajustes, mapa, limite de tempo, som    | ✅ feito   | `f5008d0` |
| 2: 9 avatares (crianças, animais, robô), pipeline de assets         | ✅ feito   | `6bc1982` |
| 3: mundo bonito (modelos CC0), água bloqueada, controle (gamepad)   | ✅ feito   | `1d61174` |
| 4a: padaria (CAA), ônibus (sequência), semáforo (no mundo 3D)       | ✅ feito   | `a8f4dfd` |
| 4b: estações de aprendizado, figurinhas, alfabeto, caixa do mercado | ✅ feito   | `2780634` |
| 4c: missões sorteadas, receitas no mercado, bairro sul com praça    | ✅ feito   | —         |
| 4d: missões da Natureza, mercado 3D por dentro, ônibus 3D           | ⏭️ próximo | —         |
| 5: mundo vivo                                                       | ⏳ depois  | —         |

## Sprint 3: mundo bonito, água e controle (feito)

- **Modelos 3D CC0** (Quaternius e Kenney, via Poly Pizza) no lugar das caixas:
  - Manifesto `scripts/world-assets.json`; `pnpm assets` roda `scripts/optimize-world.mjs`: centraliza, junta malhas, simplifica as casas, reduz texturas para 256 px WebP (sharp) e comprime com meshopt. Total ≈ 1,2 MB em `public/models/world/`.
  - `src/presentation/world/world-assets.ts` carrega tudo antes de montar a ilha: `clone(id, recolor)` (cores por nome de material, cada casa de uma cor), `parts(id)` para `InstancedMesh`, `fitFootprint`/`fitHeight`.
  - Cidade: casas, mercado (com bancas de frutas), padaria, carros estacionados e árvores de rua. Natureza: 7 árvores, arbustos e flores em canteiros, grama, pedras e cogumelos, tudo instanciado.
  - Sem modelo bom: ônibus, poste, banco, ponto de ônibus, semáforo e fonte continuam procedurais, refeitos com cantos arredondados (`props.ts`).
  - Atenção: materiais "blend" do GLB chegam com `depthWrite = false`; para folhas recortadas (`alphaTest`) é preciso ligar de novo (feito em `prepare()`).
- **Placas 3D** (`sign.ts`): tábua com espessura e bordas arredondadas, emoji num círculo, texto com sombra; `createPostSign` para placas em postes.
- **Água:** `SHORE_MARGIN = 0.6` em `terrain-shape.ts`; a criança para na areia, acima das ondas.
- **Controle** (`src/presentation/engine/gamepad.ts`, testado): analógico esquerdo/direcional anda (borda ou RB/RT corre), analógico direito gira a câmera, A pula, B/X usa, Start abre o menu. Nos painéis o direcional move o foco (`ui/pad-focus.ts`), A confirma e B volta. Aviso "🎮 Controle conectado!".
- Atalhos de dev novos: `window.lilo.teleport(x, z, yaw?)`, `window.lilo.where()`, `window.lilo.scene`.

Pendências pequenas: testar com controle físico (só a lógica tem teste); a Área dos pais (segurar 3 s) não abre pelo controle, de propósito.

## Sprint 4a: missões novas (feito)

- `Mission.kind` (`pick-items`, `build-sentence`, `sequence`, `world-task`): o motor `MissionAttempt` é o mesmo; só o painel muda (`mission-panel.ts`). Frases e sequências preenchem espaços numerados; na sequência os cartões aparecem embaralhados, sempre na mesma ordem (`shelfOrder`).
- **Padaria (CAA):** [eu quero] + [pão]; no fim o jogo fala a frase ("Eu quero pão. Aqui está!").
- **Ônibus:** esperar no ponto → entrar → sentar → apertar o botão.
- **Semáforo (no mundo 3D):** a criança anda até a faixa (🚦), espera o boneco verde na calçada e atravessa. Pisar na rua no vermelho só gera a dica "espere o boneco verde". Um cartão pequeno embaixo mostra os passos.
  - Ciclo puro e testado em `src/domain/city/traffic-light.ts` (o boneco só fica verde com os carros parados, com margem de segurança).
  - `CrossingTracker` (`src/presentation/world/crosswalk.ts`, testado) transforma a posição em eventos da missão.
  - Semáforo 3D novo: luzes dos carros viradas para a rua e sinal de pedestre (boneco vermelho parado / verde andando) virado para a calçada. As árvores ao lado da faixa saíram, para a criança ver o sinal.
- Estrelas: a Cidade dá 4 (mercado, padaria, ônibus, semáforo) e a Natureza (3) abre. Teste novo em `content.test.ts`: todo mundo pode ser aberto com as estrelas dos anteriores (até o primeiro mundo ainda sem missões).
- **Falta conteúdo:** a Natureza ainda não tem missões, então a Casa (6 estrelas) continua fechada.

## Sprint 4b: estações de aprendizado e figurinhas (feito)

- **Domínio** (`src/domain/learning/`, puro e testado):
  - `createChallenge(skill, level, random, words)`: Letras (1: letra inicial entre 3; 2: entre 4; 3: palavra ↔ figura), Números (1: contar até 5; 2: até 10; 3: soma visual até 10), Moedas (pagar o preço com moedas: até 3, 6 e 10). A letra inicial ignora acentos (ÁRVORE → A).
  - `ChallengeSession`: 3 acertos seguidos sobem o nível (máximo 3); errar nunca rebaixa, só reinicia a sequência e dá a dica (igual às missões).
  - `Random`, `seededRandom`, `shuffled`, `pick` foram para `src/domain/shared/random.ts`; a apresentação reexporta.
- **Progresso:** nível por habilidade, figurinhas e letras do alfabeto (`PlayerProgress.recordChallenge`). Cada acerto dá 1 moeda; a primeira vez de cada habilidade e cada nível novo dão figurinha + estrela (no máximo 9 estrelas).
- **Casos de uso:** `StartChallenge`, `AnswerChallenge`, `GetAlbum`; port `RandomSource` (o container usa `Math.random`, os testes usam semente).
- **Palavras** em `src/infrastructure/catalog/words.ts`; as moedas usam só coisas que se compram (`SHOP_ITEMS`).
- **Mundo:** 3 estações na cidade (`src/presentation/world/stations.ts`): Letras (blocos A B C, lado norte, x −27), Números (caixotes 1 2 3, lado norte, x 10) e Moedas (moeda gigante girando, lado sul, x 27,5). Painel `challenge-panel.ts` com estrelas de nível e bolinhas da sequência; controller `learning-controller.ts` (modo `learning`).
- **Álbum** em "Meu progresso": 9 figurinhas e o alfabeto colecionável.
- **Caixa do mercado:** depois dos itens, a prateleira vira o caixa (`MissionChoice.group = 'cashier'`) e a criança paga 3 moedas; no fim o caixa diz "Obrigado! Volte sempre!" (`Mission.farewell`).
- Árvores de rua tiradas da frente das estações.

## Sprint 4c: missões que variam e cidade maior (feito)

- **Missões sorteadas** (`src/domain/mission/prepare-mission.ts`, puro e testado): `Mission.variants` (o jogo sorteia uma a cada vez) e `Mission.distractors` (quantos cartões errados entram junto, também sorteados). A prateleira do mercado muda de ordem; os cartões de CAA ficam sempre no mesmo lugar; no caixa as moedas erradas são as vizinhas da certa (2, 3, 4). `StartMission` recebe a `RandomSource`.
- **Mercado com receitas:** 9 receitas de 2 a 4 ingredientes (bolo, salada, sanduíche, sopa, vitamina, suco, arroz com feijão, café da manhã, pipoca), 19 itens. O caixa cobra 1 moeda por item; a comemoração mostra o prato pronto (`Mission.result`). Um teste garante que todo item da prateleira aparece em alguma receita.
- **Padaria:** 4 lanches e o cartão "por favor" (frase: "Eu quero pão, por favor").
- **Ônibus:** duas versões, uma com "passar o cartão".
- **Bairro sul** (área plana `SOUTH_DISTRICT`): avenida em z = 36 com 5 casas, postes e árvores; duas ruas ligando a avenida à rua principal (x = −31,5 e 28,5); **praça** com coreto, bancos, canteiros e placa; **parquinho** com escorregador e balanço. A estação de Moedas foi para a praça.
- Ruas feitas pelo planejador puro `street-plan.ts` (testado): calçadas abrem nos cruzamentos, nada se sobrepõe (sem faces piscando), tracejado fora de cruzamentos e da faixa.
- Nomes curtos no mapa (Letras, Números, Moedas, Faixa).

## Sprint 4d: próximos

- **Mercado 3D por dentro:** transição com fade para um interior com prateleiras de frutas 3D e um carrinho; a criança anda até o item e o item voa para o carrinho; no caixa, uma pessoa (modelo CC0) diz "Obrigado!".
- **Ônibus em 3D:** o ônibus estacionado vem até o ponto durante a missão e a criança entra nele.
- **Missões da Natureza** (abre com 3 estrelas): sem elas, a Casa (6) só abre pelas estrelas das estações. Ideias: regar as plantas (sequência), achar animais pelo som, separar o lixo.
- **Mais estações:** moedas-letra escondidas pela ilha (para o alfabeto) e placas palavra ↔ figura nas trilhas.
- Recompensa visual ao ganhar figurinha: brilho e confete no mundo, além do aviso no painel.

## Sprint 5: mundo vivo

### Mundo vivo (`src/presentation/life/`)

- **Lógica pura e testada:**
  - Seguidor de waypoints.
  - Semáforo compartilhado.
  - Distância entre carros e parada na faixa.
- **Pessoas andando** nas calçadas. Reaproveitar avatares (Ana, Lis, Sam, Téo) e os personagens adultos que ficaram de fora (abaixo). Elas param no vermelho e **acenam** quando o jogador chega perto.
- **Carros** devagar pela rua: param no semáforo e **sempre** param para o jogador na faixa. O ônibus faz a rota e para no ponto.
- **Barcos** à vela no mar.
- **Animais:**
  - Pássaros e borboletas.
  - Cachorro e gato passeando no parque.
  - Patos num lago novo.
  - Ovelha, vaca, porco e cavalo numa fazenda.
- **Som ambiente** posicional (WebAudio panner).
- **Desempenho:**
  - Agentes a mais de 80 m pausados.
  - Qualidade (baixa, média ou alta) automática pelo FPS.
  - O ajuste "Movimento na cidade: Calmo" (já salvo em `Settings.worldActivity`) reduz a quantidade de agentes.

### Modelos CC0 já encontrados (Quaternius, via Poly Pizza)

Links diretos `https://static.poly.pizza/<uuid>.glb`:

| Modelo                                                                | Uso sugerido                 | Página                                                                             |
| --------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Husky, Shiba Inu (quadrúpedes, Walk/Gallop/Idle)                      | cachorros no parque          | `wcWiuEqwzq`, `y4wdQpg767`                                                         |
| Sheep, Cow, Pig, Horse                                                | fazenda                      | `C39AUXUUes`, `5XSc2Fka3F`, `u35l6uP5vj`, `D3hAeqeDBE`                             |
| Characters Matt, Farmer, Worker, Woman Casual, Casual/Beach Character | pedestres e caixa do mercado | `66kQ4dBBC7`, `7pn3R6hPvE`, `Yg2bQZO6Hj`, `jpKRgGDxhk`, `kZ3DmIoGip`, `DojKLcO34E` |
| Chick, Pigeon, Birb                                                   | aves                         | `LH96IMq0rE`, `9NGlBTpDEr`, `gZ2ExU9OAB`                                           |

Páginas: `https://poly.pizza/m/<id>`. Confirmar "Quaternius" e "CC0 1.0" antes de usar. Os NPCs podem usar o mesmo pipeline do `scripts/avatars.json` (criar um manifesto `scripts/npcs.json`).

## Notas para quem continuar

- **Ferramentas:**
  - `pnpm dev`, `pnpm check` (lint, typecheck e testes, o mesmo que a CI), `pnpm build`, `pnpm assets` (reconstrói avatares e modelos do mundo).
  - Para achar modelos CC0: a busca `https://poly.pizza/search/<termo>` traz os resultados em JSON (`window.__SERVER_APP_STATE__`); o GLB está em `static.poly.pizza/<uuid>.glb` na página do modelo (precisa de User-Agent).
  - Node 22.13; o TypeScript fica fixado na 6.0, porque o typescript-eslint ainda não suporta a 7.
  - Não usar jsdom: a versão atual não roda no Node 22.13. Usar `tests/support/memory-storage.ts`.
- **Arquitetura:**
  - `domain` e `application` não importam pacotes externos (garantido pelo lint).
  - Cada criança tem serviços próprios: `services.forPlayer(profileId)`.
  - Cada novo caso de uso precisa de teste; manter a cobertura de 80% ou mais nessas camadas.
- **Testar no navegador:**
  - O usuário costuma deixar o próprio servidor na porta **5173**: não mexer nele e usar `pnpm exec vite --port 5180 --strictPort`.
  - Screenshots com puppeteer-core e o Chrome do sistema, com `--use-angle=metal --enable-gpu` (cerca de 30 FPS; o SwiftShader fica em 1 FPS).
  - Atalhos só de dev no console: `window.lilo.goTo('market' | 'home' | 'bakery' | 'bus-stop')`, `window.lilo.use(id)`, `window.lilo.addPlayTime(min)`.
  - Subir servidor HTTP local é bloqueado; para páginas de teste fora do projeto, abrir via `file://` com `--allow-file-access-from-files`.
- **Visual:** o padrão é alto, porque o público joga Minecraft e Goat Simulator. Toda mudança visual precisa ser conferida por screenshot.
- **Princípios** (checklist em [CONTRIBUTING.md](CONTRIBUTING.md)):
  - Uma instrução por vez.
  - Errar nunca pune.
  - Alvos de toque de 88 px ou mais.
  - Nada de dados fora do aparelho.
- **Git:**
  - Conventional Commits; os hooks (lint-staged e commitlint) rodam sozinhos.
  - Push grande: o repositório já tem `http.postBuffer` aumentado.
  - Repositório: https://github.com/ismael-figueiredo/lilo-world
