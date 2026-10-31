# Roteiro de sentimentos: proposta para revisão

Este roteiro é uma **proposta** e ainda não foi revisado. Pelo critério D12 do [plano](plano-vida-real.md), nada disto deve chegar às crianças antes da revisão de uma fonoaudióloga ou terapeuta ocupacional. Por isso as cenas ficam **desligadas por padrão** e o adulto só as encontra na área dos pais.

O texto das cenas está em [`src/domain/feelings/scenes.ts`](../src/domain/feelings/scenes.ts).

## Como cada cena funciona

1. **Ver:** a situação acontece com um colega, em uma frase curta.
2. **Notar:** o rosto muda e a frase aponta o corpo ("os ombros caíram"), ainda sem dar nome ao sentimento. A criança pode ver de novo quantas vezes quiser.
3. **Nomear:** dois rostos dos próprios personagens, lado a lado, e duas palavras. Não há emoji nem pontos.
4. **O que ajuda:** a criança escolhe e vê o resultado. Todas as opções levam a um resultado tranquilo.

## Perguntas para a revisão

- Os cinco sentimentos (feliz, triste, com raiva, com medo, surpreso) são um bom começo? Falta "calmo", ou algum deveria sair?
- A linguagem está simples e concreta? Alguma frase é figurada demais?
- Descrever o corpo antes de nomear ajuda ou confunde?
- As cenas de raiva (fila, brinquedo) e de medo (trovão, cachorro, balão) podem assustar ou gerar imitação? Alguma deve sair?
- "Dar um tempo" e "chamar um adulto" estão bem apresentados como formas de ajudar?
- A resposta "certa" ao nomear deveria existir? Há cenas em que dois sentimentos seriam válidos?
- O medidor "Como eu estou" e o registro visível ao adulto são adequados? Por quanto tempo guardar? Hoje ficam 14 registros, só no aparelho.
- O cantinho calmo deve oferecer só respiração? Três respirações com um botão é um bom ritmo?

## Cenas propostas

| Cena              | Sentimento | Outro rosto | Formas de ajudar          |
| ----------------- | ---------- | ----------- | ------------------------- |
| Sorvete cai       | Triste     | Feliz       | Ajudar, dar tempo, adulto |
| Pegaram brinquedo | Com raiva  | Feliz       | Dar tempo, adulto, ajudar |
| Fez gol           | Feliz      | Triste      | Brincar junto, dar tempo  |
| Trovão            | Com medo   | Feliz       | Adulto, ajudar, dar tempo |
| Sozinho no pátio  | Triste     | Surpreso    | Brincar junto, dar tempo  |
| Presente          | Surpreso   | Com raiva   | Brincar junto             |
| Torre caiu        | Triste     | Feliz       | Ajudar, dar tempo         |
| Passou na fila    | Com raiva  | Surpreso    | Adulto, dar tempo         |
| Desenho elogiado  | Feliz      | Com medo    | Brincar junto             |
| Cachorro grande   | Com medo   | Feliz       | Adulto, ajudar            |
| Lápis perdido     | Triste     | Surpreso    | Ajudar, adulto            |
| Balão estourou    | Surpreso   | Triste      | Dar tempo, ajudar         |

## Também para revisar: segurança na praia

- A criança só entra na água com a bandeira verde e com o adulto, e nunca passa das boias. Com bandeira amarela fica na areia.
- As frases estão em `src/application/phrases.ts`, com nomes que começam por `water`.
- A pergunta para a revisão: essa regra simples passa uma ideia segura do mar, ou pode dar a entender que o mar é seguro só por ter boias?

## Quando for aprovado

1. Ajustar o texto em `scenes.ts`.
2. Ligar as cenas por padrão.
3. Tirar o Jardim das Emoções e suas missões (C11.8), preservando o progresso antigo.
