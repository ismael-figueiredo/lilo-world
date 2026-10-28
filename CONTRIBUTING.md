# Como contribuir

Obrigado por querer ajudar! O Lilo World é feito por voluntários: pessoas desenvolvedoras, artistas, terapeutas, professoras e famílias. Toda ajuda conta, inclusive a que não envolve código.

> Contributions in English are welcome too. Issues and pull requests can be written in Portuguese or English.

Ao participar, você concorda com o nosso [Código de Conduta](CODE_OF_CONDUCT.md).

## Formas de ajudar

| Você é…                          | Como ajudar                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Terapeuta, professora ou família | Sugira missões, teste com crianças e conte o que funcionou ([modelos de issue](../../issues/new/choose)) |
| Artista 3D ou 2D                 | Modelos low-poly, pictogramas e ícones (licença CC BY-NC-SA 4.0 ou CC0)                                  |
| Dubladora ou locutora            | Gravações em português com voz calma e acolhedora                                                        |
| Pessoa desenvolvedora            | Issues marcadas como `good first issue` e `help wanted`                                                  |
| Tradutora                        | Novos idiomas (Fase 4)                                                                                   |

## Preparando o ambiente

Requisitos: **Node.js 22+** (veja `.nvmrc`) e **pnpm** (`corepack enable`).

```bash
git clone https://github.com/ismael-figueiredo/lilo-world.git
cd lilo-world
pnpm install      # também instala os git hooks (Husky)
pnpm dev
```

Antes de abrir um PR, rode:

```bash
pnpm check        # lint, typecheck e testes com cobertura: o mesmo que a CI roda
```

## Fluxo de trabalho

1. Abra ou escolha uma issue e comente que vai trabalhar nela.
2. Crie um branch a partir de `main`: `feat/missao-onibus`, `fix/camera-parede`, `docs/readme`.
3. Faça commits pequenos no padrão **[Conventional Commits](https://www.conventionalcommits.org/pt-br/)**. O commitlint confere a mensagem:
   - `feat: adiciona missão do ônibus`
   - `fix: câmera atravessava a padaria`
   - `docs: explica como criar uma missão`
   - Outros tipos: `refactor`, `test`, `chore`, `style`, `perf`, `ci`
4. Abra o PR preenchendo o modelo, com screenshots ou vídeo quando a mudança for visual.
5. A CI precisa passar e pelo menos uma pessoa mantenedora revisa.

O hook de pre-commit roda ESLint e Prettier nos arquivos alterados.

## Arquitetura: as regras mais importantes

Leia [docs/architecture.md](docs/architecture.md). Em resumo:

- **`domain/`** contém só regras puras do jogo. Não importa nada de fora (nem Three.js, nem `window`, nem pacotes npm).
- **`application/`** contém casos de uso e **ports** (interfaces). Importa só o domínio.
- **`infrastructure/`** implementa os ports (localStorage, Web Speech, catálogo de conteúdo).
- **`presentation/`** cuida da parte 3D e da interface. Fala com o jogo **só** pelos casos de uso em `GameServices`.
- **`main/`** é o composition root: o único lugar que instancia as implementações concretas.

O ESLint (`eslint-plugin-boundaries` + `no-restricted-imports`) bloqueia imports que quebram essas regras. Se o lint reclamar de uma fronteira, quase sempre a solução é criar um port na aplicação e implementá-lo na infraestrutura.

### Testes

- Toda regra nova em `domain/` ou `application/` precisa de teste (mínimo de 80% de cobertura nessas camadas).
- Partes puras da apresentação (matemática do terreno, colisão, movimento) também são testadas em `tests/presentation/`.
- Os testes usam adaptadores em memória (`InMemoryProgressRepository`, `FakeSpeech`, `MemoryStorage`), nunca o navegador real.

## Como criar uma missão nova

1. **Conteúdo:** adicione a missão em [src/infrastructure/catalog/content.ts](src/infrastructure/catalog/content.ts), com escolhas (pictogramas), passos (uma instrução curta cada) e recompensa. Ligue o id da missão ao mundo em `worlds`.
2. **Lugar no mundo:** crie ou reaproveite um ponto de interesse em [src/presentation/world/city.ts](src/presentation/world/city.ts) e mapeie a missão para ele em `missionPlaces` ([src/presentation/game-app.ts](src/presentation/game-app.ts)).
3. **Interface:** missões de "escolher itens" já funcionam com o `MissionPanel`. Tipos novos (montar frase CAA, sequência, emoções) ganham um painel próprio em `src/presentation/ui/`.
4. **Testes:** o teste `tests/infrastructure/content.test.ts` confere ids e passos automaticamente. Regras novas ganham testes de domínio.

## Como adicionar um personagem

1. Escolha um modelo glTF animado **CC0** (por exemplo, da Quaternius no [Poly Pizza](https://poly.pizza)) com animações de parado, andar, correr, pular, acenar e "sim".
2. Adicione uma entrada em [scripts/avatars.json](scripts/avatars.json) com o link do `.glb`, os objetos a esconder (`hide`) e o nome original de cada animação.
3. Rode `pnpm assets`. O script gera `public/models/avatars/<id>.glb`.
4. Registre o personagem em `avatars` ([src/infrastructure/catalog/content.ts](src/infrastructure/catalog/content.ts)) e o ajuste 3D em [src/presentation/actors/avatar-rigs.ts](src/presentation/actors/avatar-rigs.ts). Use `fit` se o chapéu ou os óculos não encaixarem sozinhos.
5. Gere a figura `public/avatars/<id>.png` (fundo transparente, 512×512) e registre a autoria em `CREDITS.md`.

### Checklist de acessibilidade e sensorial (obrigatório em PRs visuais)

- [ ] Instruções com **uma ação por frase**, curtas e positivas ("Pegue a maçã"), nunca "Errado!"
- [ ] O erro **não pune**: sem som alto, sem tremer a tela, sem perder moedas
- [ ] Alvos de toque com pelo menos **88 px**
- [ ] Animações suaves e lentas, sem piscar (nada acima de 3 flashes por segundo)
- [ ] O objeto importante se destaca (brilho, seta, cor) sem poluir o resto da cena
- [ ] Funciona com "reduzir movimento" ativado no aparelho
- [ ] Testado em tela de tablet (1024×768 ou maior) e de celular em paisagem
- [ ] Mantém 30 FPS ou mais num tablet comum (instancie objetos repetidos)

## Arte e licenças

- Todo arquivo de arte, som ou texto do jogo entra sob **CC BY-NC-SA 4.0** ([LICENSE-ASSETS.md](LICENSE-ASSETS.md)) ou precisa ter licença compatível (CC0, CC BY, CC BY-SA, CC BY-NC-SA).
- Registre a autoria e a licença de todo material de terceiros em [CREDITS.md](CREDITS.md).
- **Pictogramas ARASAAC** exigem a atribuição descrita em `CREDITS.md`.
- Não use material com direitos reservados, de outros jogos ou gerado a partir de personagens de terceiros.

## Privacidade (inegociável)

O jogo é usado por crianças. Por isso, **não aceitamos** contribuições que:

- Enviem qualquer dado para fora do aparelho (analytics, telemetria, logs remotos)
- Adicionem anúncios, compras, contas obrigatórias, chat ou links externos dentro do jogo
- Carreguem scripts de terceiros em tempo de execução

## Dúvidas

Abra uma [discussão](../../discussions) ou uma issue. Não existe pergunta boba.
