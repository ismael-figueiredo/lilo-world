/**
 * Everything Lilo says that is not content of an activity or mission, by id:
 * the voice can be recorded later without touching the code that says it.
 * Short and warm. A wrong answer is never called "wrong".
 */
export const phrases = {
  correct: 'Isso!',
  completed: 'Você conseguiu! Muito bem!',
  model: 'Olhe, é esta:',
  modelOption: 'Olhe, esta serve:',
  levelUp: 'Você subiu de nível!',
  sticker: 'Ganhou uma figurinha!',
  practiced: 'Agora você viu como é.',
  roundShort: 'Por hoje está ótimo!',
  roundDone: 'Você terminou! Muito bem!',

  padConnected: '🎮 Controle conectado!',
  padDisconnected: 'O controle desligou.',
  hello: (name: string) => `Oi, ${name}! Eu sou o Lilo.`,
  welcomeBack: (name: string) => `Que bom te ver, ${name}!`,
  arrived: (place: string) => `Você chegou: ${place}!`,
  redLight: 'O boneco está vermelho. Vamos esperar na calçada.',
  keepToSidewalk: 'A rua é dos carros. Ande na calçada e atravesse na faixa.',
  lastMission: 'Falta pouco! Mais uma missão e depois vamos descansar.',
  rest: (name: string) => `Hora de descansar, ${name}. Você brincou muito bem!`,

  starsMissing: (stars: number, world: string) =>
    `Ganhe mais ${stars} ${stars === 1 ? 'estrela' : 'estrelas'} para abrir ${world}.`,
  welcomeNature: 'Bem-vindo à Natureza! Visite a fazenda, a horta e a reciclagem.',
  welcomeEmotions: 'Bem-vindo ao Jardim das Emoções! Vamos conhecer o que sentimos.',
  welcomeSchool: 'Bem-vindo à Escola! Visite a sala de aula, a professora e o parque.',
  welcomeHome: 'Bem-vindo à Casa! Vamos cuidar das nossas rotinas.',
  worldNotReady: (world: string) => `${world} ainda está sendo construído!`,

  goToMission: (place: string) => `Vamos para: ${place}? Siga a seta amarela!`,
  backToMission: (place: string) => `Que tal voltar em: ${place} e ganhar mais moedas?`,
  goToPortals: 'Vamos aos portais! Siga a seta amarela.',
  goToPlace: (place: string) => `Vamos para: ${place}! Siga a seta amarela.`,
  goToStation: (place: string) => `Vamos até ${place}! Siga a seta.`,

  dayStart: 'Por onde vamos começar?',
  dayNext: 'O que vem agora?',
  dayAllDone: 'Você já fez tudo de hoje. Pode brincar à vontade!',
  dayEnd: 'Hoje você fez tudo isso! Até a próxima.',

  wardrobeOpen: 'Escolha um personagem e uma roupa!',
  avatarChanged: (name: string) => `Oi! Agora você é: ${name}!`,
  coinsMissing: (coins: number) => `Faltam ${coins} moedas. Vamos ao mercado ganhar mais?`,
  itemWorn: (item: string) => `${item}! Ficou ótimo!`,

  missionStart: (introduction: string, prompt: string) => `${introduction} ${prompt}`,
  missionNotReady: 'Essa missão ainda não está pronta.',
  sentenceReady: 'Pronto! Agora é só falar.',
  sentenceSaid: (sentence: string, answer: string | undefined) =>
    answer === undefined ? `${sentence}.` : `${sentence}. ${answer}`,
  missionDone: (farewell: string | undefined) =>
    farewell === undefined ? phrases.completed : `${farewell} ${phrases.completed}`,

  voicePreview: 'Oi! Assim está bom?',
} as const;
