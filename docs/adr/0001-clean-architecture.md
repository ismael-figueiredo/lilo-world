# ADR 0001: Clean Architecture com inversão de dependência

- **Status:** aceita
- **Data:** 2026-10-28

## Contexto

O jogo vai crescer por anos, com contribuições de voluntários: novos mundos e missões, painel para terapeutas, talvez uma versão nativa. As regras pedagógicas (errar não pune, uma instrução por vez, recompensas) precisam continuar corretas mesmo quando o motor gráfico ou o armazenamento mudarem.

## Decisão

- Separar o código em `domain`, `application`, `infrastructure`, `presentation` e `main`.
- A aplicação declara **ports** (interfaces). A infraestrutura os implementa e só o `main` faz a ligação (DI manual por construtor).
- Garantir as fronteiras com ESLint (`eslint-plugin-boundaries` e `no-restricted-imports`), para que a CI falhe quando uma regra for quebrada.
- Domínio imutável, com `Result` explícito em vez de exceções para resultados esperados.

## Consequências

- **Positivas:** regras testáveis sem navegador (testes rápidos e confiáveis), troca simples de adaptadores e um caminho claro para cada tipo de contribuição.
- **Negativas:** um pouco mais de arquivos e de cerimônia para recursos pequenos.
