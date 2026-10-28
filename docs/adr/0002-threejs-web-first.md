# ADR 0002: mundo aberto 3D com Three.js, primeiro no navegador

- **Status:** aceita (substitui a ideia inicial de Phaser 2D no protótipo)
- **Data:** 2026-10-28

## Contexto

O público-alvo já joga Minecraft, simuladores e jogos de mundo aberto. Um primeiro protótipo 2D com formas simples não chamou a atenção: o jogo precisa ser **3D, de mundo aberto e com riqueza gráfica**, e mesmo assim rodar bem em tablets comuns e sem instalação.

Opções avaliadas: Three.js, Babylon.js e Godot.

## Decisão

- **Three.js** em TypeScript, rodando no navegador (web/PWA).
- Estilo **low-poly estilizado**: cores vivas, sombreamento facetado e geometria gerada por código (leve e fácil de manter).
- Personagem com animações a partir de modelo **CC0** (RobotExpressive, Quaternius), recolorido e com acessórios presos aos ossos.
- Interface em **HTML/CSS** sobre o canvas: texto nítido, acessível e com alvos de toque grandes.
- Desempenho: `InstancedMesh` para vegetação, sombras que acompanham o personagem e pixel ratio limitado a 2.

## Consequências

- **Positivas:** mesma linguagem e arquitetura do resto do projeto, deploy estático em qualquer servidor ou VPS, nada para instalar no tablet e ecossistema enorme.
- **Negativas:** sem editor visual de cenas (o layout do mundo fica em código) e física simples feita à mão. Se o mundo crescer muito, avaliar Rapier (física) e streaming de áreas.
- Godot continua uma opção futura para versões nativas. As camadas `domain` e `application` podem servir de referência para isso.
