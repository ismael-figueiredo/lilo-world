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
| 4c: missões sorteadas, receitas no mercado, bairro sul com praça    | ✅ feito   | `0d41a2d` |
| 4d: mundo Natureza (acampamento, fazenda, horta, reciclagem)        | ✅ feito   | `3139b1f` |
| 4e: mundo Casa (banheiro, quarto, cozinha)                          | ✅ feito   | `1ff1687` |
| 4f: mundo Escola e Parque (mochila, falar na escola, esperar a vez) | ✅ feito   | `1c4509a` |
| 4g: mundo Emoções (rostos, histórias, ficar calmo)                  | ✅ feito   | —         |
| 4h: mercado 3D por dentro, ônibus 3D, mais estações                 | ⏭️ próximo | —         |
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

## Sprint 4d: mundo Natureza (feito)

- O portal da Natureza (aberto com 3 estrelas) leva, com um fade (`GameApp.travel`), ao **Acampamento** numa clareira plana do oeste da ilha (`src/presentation/world/nature-camp.ts`, `NATURE_CAMP`). Também dá para chegar andando. Um portal verde leva de volta aos portais.
- Novo tipo de missão `quiz` (respostas escondidas até achar) e `MissionStep.show` (o que aparece grande na pergunta, como "🔊 Muuu!").
- Missões (1 estrela cada, com variantes sorteadas):
  - **Sons da fazenda** (`nature-animals`): 8 animais; a fazenda tem vaca, cavalo, ovelha, porco e pintinho 3D (Quaternius, CC0).
  - **Plantar uma flor** (`nature-garden`): cavar → semente → cobrir → regar → sol → 🌻.
  - **Separar o lixo** (`nature-recycling`): lixeiras nas cores usadas no Brasil (azul papel, vermelho plástico, verde vidro, amarelo metal, marrom orgânico).
- Com a Natureza, a Cidade + Natureza dão 7 estrelas: a Casa (6) abre pelas missões.
- Pipeline: modelos do mundo perdem animações e esqueleto (ficam parados); sem isso, a compressão perdia a escala dos animais e eles sumiam. `WorldAssets.clone` usa `SkeletonUtils.clone`.

## Sprint 4e: mundo Casa (feito)

- O portal da Casa (6 estrelas) leva com fade a uma "casa de bonecas" aberta na frente, a leste do bairro sul (`src/presentation/world/home-area.ts`, `HOME_AREA`), com banheiro, quarto e cozinha mobiliados e um portal de volta.
- Missões (1 estrela cada, com variantes):
  - **Cuidar de mim** (`home-hygiene`, sequência): escovar os dentes (4 passos) ou lavar as mãos (5 passos).
  - **Roupa para o tempo** (`home-dressing`, quiz): frio → casaco, chuva → guarda-chuva, calor → bermuda, lama → botas, praia → chinelo…
  - **Pôr a mesa** (`home-table`, lista): almoço, café da manhã ou jantar.
- `Interactable.viewFrom` escolhe de que lado a câmera mostra o lugar na missão (os cômodos abrem para o sul).
- Teste novo: a introdução nunca repete a primeira instrução (antes saía "O que vem primeiro? O que vem primeiro?").
- Agora Cidade + Natureza + Casa dão 10 estrelas: Escola e Parque (9) abre. Falta o conteúdo dela.

## Sprint 4f: mundo Escola e Parque (feito)

- O portal da Escola (9 estrelas) leva com fade a uma escola num morro do nordeste (`src/presentation/world/school-area.ts`, `SCHOOL_AREA`): sala de aula aberta (carteiras, lousa, estante, mesa da professora) e parque (escorregador, balanço, caixa de areia), com portal de volta.
- Missões (1 estrela cada, com variantes):
  - **Arrumar a mochila** (`school-backpack`, lista): matemática, arte, leitura, educação física ou passeio.
  - **Falar na escola** (`school-talk`, CAA): bom dia para a professora ou o amigo, pedir ajuda, pedir para ir ao banheiro ou beber água, convidar para brincar. Cada variante tem a resposta de quem ouviu.
  - **Esperar a vez** (`school-turn`, sequência): no escorregador ou no balanço.
- `spokenSentence` (pura, testada): vírgulas onde se fala ("Bom dia, professora", "…, por favor"). A frase de CAA termina com a resposta da variante, não mais com o "Aqui está!" da padaria.
- Agora as quatro áreas dão 13 estrelas: Emoções (12) abre. Falta o conteúdo dela.

## Sprint 4g: mundo Emoções (feito)

- O portal de Emoções (12 estrelas) leva com fade ao **Jardim das Emoções** no sudoeste (`src/presentation/world/emotions-garden.ts`, `EMOTIONS_GARDEN`): cinco rostos grandes em meio círculo, um pequeno teatro de histórias e o **cantinho calmo** (toldo, pufes, ursinho, luz que "respira" devagar), com portal de volta.
- Missões (1 estrela cada, com variantes):
  - **Como ele está?** (`emotions-faces`, quiz): feliz, triste, bravo, com medo, surpreso. A pergunta mostra outro rosto do mesmo sentimento (😭 → cartão 😢 triste), para generalizar.
  - **Histórias e sentimentos** (`emotions-stories`, quiz): "Ganhei um presente 🎁", "Meu sorvete caiu", "Pegaram meu brinquedo sem pedir", "Fez um trovão"…
  - **Ficar calmo** (`emotions-calm`, sequência): parar → respirar → contar até 5 → dizer como me sinto; ou o cantinho calmo com o ursinho; ou pedir um abraço quando triste.
- Testes novos no conteúdo: a pergunta nunca mostra a própria figura do cartão certo; a despedida nunca repete o elogio que o jogo já diz.
- Com os 5 mundos completos, a ilha dá 16 estrelas pelas missões (+9 das estações).

## Sprint 4h: próximos

- **Mercado 3D por dentro:** transição com fade para um interior com prateleiras de frutas 3D e um carrinho; no caixa, uma pessoa diz "Obrigado!".
- **Ônibus em 3D:** o ônibus estacionado vem até o ponto durante a missão.
- **Mais estações:** moedas-letra escondidas pela ilha (para o alfabeto) e placas palavra ↔ figura nas trilhas.
- Revisão com terapeutas: textos, ordem das rotinas e cores das emoções.

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
