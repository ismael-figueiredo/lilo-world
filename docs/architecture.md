# Arquitetura

O Lilo World segue a **Clean Architecture** com **inversão de dependência**. As regras do jogo (moedas, dicas, desbloqueios) ficam isoladas da parte 3D, do navegador e do armazenamento. Assim dá para trocar o motor gráfico, guardar o progresso em outro lugar ou levar o jogo para outra plataforma sem reescrever as regras.

## Camadas

```mermaid
flowchart TB
  subgraph main["main (composition root)"]
    container["container.ts<br/>createServices / createBrowserAdapters"]
  end
  subgraph presentation["presentation"]
    gameapp["GameApp"] --> world3d["world/ (terreno, cidade, portais)"]
    gameapp --> actors["actors/ (Player, Mascot)"]
    gameapp --> ui["ui/ (HUD, missão, guarda-roupa)"]
  end
  subgraph application["application"]
    services["GameServices"] --> usecases["use-cases/"]
    usecases --> ports["ports/ (interfaces)"]
  end
  subgraph infrastructure["infrastructure"]
    storage["LocalStorageProgressRepository"]
    speech["WebSpeech / SilentSpeech"]
    catalog["StaticContentCatalog"]
  end
  subgraph domain["domain"]
    rules["Coins · MissionAttempt · PlayerProgress · World"]
  end

  container --> gameapp
  container --> storage & speech & catalog
  gameapp --> services
  usecases --> rules
  storage -. implementa .-> ports
  speech -. implementa .-> ports
  catalog -. implementa .-> ports
```

| Camada           | Responsabilidade                                                                                  | Pode importar                             |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `domain`         | Regras puras e imutáveis: moedas, missão (pedido → ação → dica), progresso, desbloqueio de mundos | só `domain`                               |
| `application`    | Casos de uso que orquestram o domínio e **ports** (interfaces) para o mundo externo               | `domain`                                  |
| `infrastructure` | Implementações dos ports: `localStorage`, Web Speech API, conteúdo estático                       | `application`, `domain`                   |
| `presentation`   | Three.js, câmera, personagem, interface HTML. Usa os casos de uso via `GameServices`              | `application`, `domain`, pacotes externos |
| `main`           | Composition root: liga as implementações concretas aos casos de uso                               | tudo                                      |

O ESLint aplica essas regras com `eslint-plugin-boundaries`. Além disso, `domain` e `application` não podem importar **nenhum** pacote externo.

## Inversão de dependência na prática

Os casos de uso dependem de **interfaces** declaradas na própria aplicação:

```ts
// application/ports/progress-repository.ts
export interface ProgressRepository {
  load(): Promise<PlayerProgress>;
  save(progress: PlayerProgress): Promise<void>;
}

// application/use-cases/buy-wardrobe-item.ts
export class BuyWardrobeItem {
  constructor(
    private readonly catalog: ContentCatalog,
    private readonly progress: ProgressRepository,
  ) {}
}
```

Só o `main/container.ts` sabe qual implementação usar:

```ts
createServices({
  catalog: new StaticContentCatalog(),
  progress: new LocalStorageProgressRepository(window.localStorage),
  speech: new WebSpeech(window.speechSynthesis, (text) => new SpeechSynthesisUtterance(text)),
});
```

Os testes passam `InMemoryProgressRepository` e `FakeSpeech` no lugar das implementações reais. Um painel de terapeuta poderia passar um catálogo editável, e uma versão nativa poderia passar um armazenamento de arquivo, sem mexer em nenhuma regra.

### Dados por criança

`GameServices` tem os casos de uso globais (perfis) e `forPlayer(profileId)`, que devolve um `PlayerServices` com repositórios **escopados** àquele perfil (chaves `lilo-world:v2:<perfil>:progress|settings|session`). Os casos de uso não sabem que existem vários perfis: o escopo é decidido só no composition root. Na primeira execução, a migração move o progresso da v1 para um perfil "Jogador".

Não há framework de injeção de dependência: os casos de uso recebem tudo pelo construtor, o que é explícito e fácil de seguir.

## Fluxo de uma missão

```mermaid
sequenceDiagram
  participant C as Criança
  participant G as GameApp (presentation)
  participant S as StartMission / ChooseMissionAnswer
  participant D as MissionAttempt (domain)
  participant R as ProgressRepository
  C->>G: toca em "Entrar no mercado"
  G->>S: startMission.execute("city-market")
  S->>D: MissionAttempt.start(mission)
  S-->>G: attempt (e Lilo fala o primeiro pedido)
  C->>G: toca na banana (errado)
  G->>S: chooseMissionAnswer.execute(attempt, "banana")
  S->>D: attempt.choose("banana")
  D-->>S: outcome "model"
  S-->>G: só a maçã fica ativa, com brilho e seta
  C->>G: toca na maçã, no leite e no pão
  D-->>S: outcome "completed"
  S->>R: save(progress.completeMission())
  S-->>G: reward (🪙 +10, ⭐ +1 na primeira vez)
```

## Apresentação 3D

| Módulo                      | Papel                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world/terrain-shape.ts`    | Altura da ilha (simplex noise + áreas planas). Puro e testado                                                                                              |
| `world/collision.ts`        | Colisão do personagem (círculos e caixas) e da câmera. Puro e testado                                                                                      |
| `world/city.ts`, `props.ts` | Cidade low-poly: casas, mercado, padaria, ônibus, semáforo, fonte                                                                                          |
| `world/nature.ts`           | Árvores, pedras, grama e flores com `InstancedMesh` (leve no tablet)                                                                                       |
| `world/zones/`              | Lugares baixados e desenhados à parte. `zone-entries.ts` lista as zonas; `anchors.ts` guarda posições e ids, que o resto do jogo conhece sem baixar a zona |
| `world/portals.ts`          | Portais para os outros mundos, com cadeado e estrelas que faltam                                                                                           |
| `actors/player.ts`          | Personagem animado (andar, correr, pular, emotes) e acessórios presos aos ossos                                                                            |
| `engine/camera-rig.ts`      | Câmera em terceira pessoa suave, que não atravessa paredes                                                                                                 |
| `ui/*`                      | Interface em HTML/CSS sobre o canvas: nítida e acessível                                                                                                   |

Decisões detalhadas ficam nas [ADRs](adr/).
