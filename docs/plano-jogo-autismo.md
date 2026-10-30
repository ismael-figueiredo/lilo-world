# Plano do Projeto: Jogo Educativo de Mundos para Crianças Autistas

> Documento inicial. Versão 0.1, outubro de 2026.

## 1. Visão

Criar um jogo **gratuito e de código aberto**, para celular, tablet e navegador, em que a criança explora **mundos coloridos**, personaliza o próprio personagem e cumpre **desafios curtos** ligados a situações reais do dia a dia: pegar ônibus, ir ao mercado, cuidar de uma planta, reconhecer emoções.

**Projeto sem fins comerciais:** o objetivo é apenas ajudar crianças a se desenvolverem de forma digital, numa linguagem em que elas têm facilidade. O jogo será sempre gratuito, sem anúncios e sem compras internas.

A ideia central é **usar aquilo de que a criança gosta (videogame, mundo aberto, personalização) como ponte para o aprendizado**, principalmente de **comunicação**. Muitas crianças autistas aprendem bem quando a informação chega de forma visual e previsível. A dificuldade costuma estar na comunicação, não na capacidade de aprender.

## 2. Público

- **Principal:** crianças autistas, com foco inicial na faixa de 5 a 12 anos.
- **Secundário:** pais, terapeutas (fono, TO, psicólogos) e professores que acompanham a criança.
- **Perfil de referência:** criança que domina celular, tablet e console, gosta de jogos como Minecraft e simuladores de carro, e adora personalizar personagens.

## 3. Princípios de design

1. **A comunicação é visual primeiro.** Figuras, ícones e voz vêm antes do texto. O texto é sempre opcional.
2. **Previsibilidade.** Todo desafio segue a mesma estrutura: **pedido → ação → comemoração**.
3. **Uma instrução por vez.** Um mascote guia fala, aponta e mostra o que fazer.
4. **Colorido, mas organizado.** O cenário é vivo, mas o objeto importante sempre se destaca (brilho, movimento, seta). Evitar poluição visual.
5. **Errar não pune.** Não há som de erro forte nem "game over". O jogo mostra a resposta certa, a criança a escolhe e a questão volta depois.
6. **Missões curtas**, de 1 a 3 minutos, com recompensa imediata.
7. **A criança escolhe.** Ela decide qual mundo e qual missão jogar, o que dá sensação de controle e aumenta o interesse.
8. **Ajustável ao sensorial.** Volume, efeitos, velocidade e intensidade das cores são configuráveis.

## 4. Estrutura do jogo

### 4.1 Base: a casa do personagem

- **Guarda-roupa:** roupas, chapéus, cores de cabelo e acessórios conquistados.
- **Mapa dos mundos:** visual, com os mundos ainda bloqueados aparecendo com cadeado.
- **Álbum de figurinhas:** registro do que a criança já aprendeu.

### 4.2 Mundos

| Mundo               | Missões                                                                                                                                                                        | Habilidades trabalhadas                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Cidade**          | Pegar ônibus (esperar no ponto, entrar, apertar o botão de parada); atravessar na faixa com o semáforo; fazer compras no mercado com lista de figuras; pedir lanche na padaria | Sequência de ações, regras sociais, pedir algo, noção de dinheiro |
| **Natureza**        | Ligar animais aos seus sons e casas; plantar e regar em sequência; ver o clima e escolher a roupa certa                                                                        | Associação, sequência, causa e efeito, autonomia                  |
| **Casa**            | Rotinas: escovar os dentes, tomar banho, arrumar a mochila, preparar a hora de dormir                                                                                          | Rotina diária, autocuidado, sequência                             |
| **Escola / Parque** | Esperar a vez no brinquedo; cumprimentar um amigo; pedir ajuda à professora                                                                                                    | Habilidades sociais, espera, comunicação                          |
| **Emoções**         | Reconhecer como os personagens se sentem e escolher como ajudá-los; dizer como "eu" estou                                                                                      | Reconhecer e expressar emoções                                    |

### 4.3 Formato padrão de uma missão

1. O mascote apresenta o pedido com uma figura e voz ("Vamos comprar maçã!").
2. A criança executa (encontrar, tocar, arrastar, escolher).
3. Se acertar, vem a comemoração: animação, som alegre, moedas e uma estrela.
4. Se não acertar, só a resposta certa fica ativa, com brilho e uma seta, e o mascote explica. Nunca há punição.

## 5. Sistema de recompensas

- **Moedas**, ganhas a cada missão, que compram itens de roupa e acessórios.
- **Estrelas**, que desbloqueiam novos mundos.
- **Figurinhas** para o álbum, uma por habilidade aprendida.
- **Itens especiais** temáticos de cada mundo (ex.: boné de motorista de ônibus na Cidade).
- Não há compras com dinheiro real nem anúncios.

## 6. Comunicação aumentativa (CAA)

- Usar **pictogramas** padronizados para que a criança reconheça as mesmas figuras na terapia e na escola.
- Sugestão: **ARASAAC** (pictogramas gratuitos). Atenção: a licença deles é CC BY-NC-SA (não comercial), o que serve para um projeto gratuito, mas precisa ser respeitada e citada.
- Nas missões de "pedir" (padaria, ajuda à professora), a criança monta frases simples tocando em figuras, por exemplo: **[eu quero] + [pão]**.
- O jogo pode falar a frase em voz alta, reforçando a ligação entre figura e palavra.

## 7. Painel dos pais e terapeutas (fase posterior)

- Escolher quais missões estão liberadas, de acordo com as metas da terapia.
- Ver o progresso simples: missões feitas, onde a criança teve mais dificuldade.
- Personalizar figuras, por exemplo trocando "maçã" por uma foto da fruta que a criança realmente come.
- Todos os dados ficam **no próprio aparelho** por padrão. Não há conta obrigatória nem coleta de dados.

## 8. Tecnologia

| Item                            | Escolha sugerida                                                | Motivo                                                                                                 |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plataforma inicial              | **Navegador (Web/PWA)**                                         | Funciona em celular, tablet e PC sem instalação, e pode ser "instalado" na tela inicial                |
| Motor 3D                        | **Three.js** (TypeScript)                                       | Mundo aberto 3D low-poly no navegador, leve em tablets (ver [ADR 0002](adr/0002-threejs-web-first.md)) |
| Motor nativo (futuro, opcional) | **Godot**                                                       | Gratuito, de código aberto, exporta para Android, iOS, Web e PC                                        |
| Funcionar offline               | Service Worker (PWA)                                            | Permite jogar sem internet                                                                             |
| Voz                             | Áudios gravados em português, com a Web Speech API como reserva | Voz clara e acolhedora                                                                                 |
| Arte                            | 3D low-poly estilizado e colorido                               | Rico visualmente, leve e fácil de manter                                                               |
| Licença do código               | **GPL-3.0**                                                     | Código aberto que precisa continuar aberto em qualquer versão derivada                                 |
| Licença da arte e dos sons      | **CC BY-NC-SA**                                                 | Mesma licença do ARASAAC: impede uso comercial e mantém tudo compartilhável                            |
| Repositório                     | GitHub                                                          | Comunidade, controle de versões, publicação gratuita via GitHub Pages                                  |

## 9. Etapas (roadmap)

### Fase 0: Preparação (1 a 2 semanas)

- [ ] Conversar com a terapeuta e a fono sobre as metas prioritárias
- [ ] Listar as 5 situações do dia a dia mais importantes para treinar
- [ ] Observar o que mais prende a atenção da criança nos jogos que ela já joga
- [ ] Criar o repositório e definir a licença

### Fase 1: Protótipo (2 a 4 semanas)

- [ ] Casa do personagem com guarda-roupa básico (5 a 10 itens)
- [ ] Mapa com o Mundo Cidade liberado
- [ ] 1 missão completa: **mercado com lista de figuras**
- [ ] Moedas e loja de roupas
- [ ] Testar com a criança e observar

### Fase 2: Mundo Cidade completo

- [ ] Missões do ônibus, do semáforo e da padaria (com CAA)
- [ ] Ajustes sensoriais (volume, efeitos, cores)
- [ ] Álbum de figurinhas

### Fase 3: Novos mundos

- [ ] Mundo Natureza
- [ ] Mundo Casa (rotinas)
- [ ] Mundo Emoções

### Fase 4: Comunidade e terapia

- [ ] Painel simples para pais e terapeutas
- [ ] Personalização de figuras e fotos
- [ ] Documentação para outras famílias e voluntários contribuírem
- [ ] Tradução e acessibilidade ampliada

## 10. Como testar com a criança

- Sessões curtas (10 a 15 minutos), num momento em que ela esteja tranquila.
- **Observar mais do que perguntar:** onde ela trava, o que ela repete, o que ignora, o que a deixa animada.
- Anotar depois de cada sessão o que ela adorou, onde teve dificuldade e o que a incomodou (som, cor, velocidade).
- Ajustar uma coisa de cada vez.
- Pedir à terapeuta que veja o jogo e sugira ajustes.

## 11. Riscos e cuidados

- **Excesso de estímulo:** cores e sons demais podem atrapalhar em vez de ajudar. Testar e ter controles de intensidade.
- **Escopo grande demais:** começar com **um mundo e uma missão**, bem feitos.
- **Tempo de tela:** o jogo apoia a terapia e não a substitui. Sugere-se combinar com a família um tempo limite e transições previsíveis para o fim da sessão (ex.: aviso visual de "falta 1 missão").
- **Privacidade:** nenhuma coleta de dados de crianças, nenhum anúncio, nenhum chat aberto.
- **Licenças de imagens e sons:** usar apenas material próprio ou com licença compatível.

## 12. Referências e inspirações

- **Jade:** app brasileiro de jogos para crianças neurodivergentes, com relatórios para pais e terapeutas.
- **Autcraft:** servidor de Minecraft seguro, criado para autistas e suas famílias.
- **ARASAAC:** banco gratuito de pictogramas para comunicação aumentativa.
- **Minecraft, simuladores de direção e jogos de personalização:** referências do que a criança já gosta.

## 13. Próximo passo imediato

Construir o **protótipo da Fase 1**: a casa com guarda-roupa, o mapa e a missão do mercado no Mundo Cidade, jogável no navegador do tablet, para testar com a criança e ajustar a partir do que ela mostrar.
