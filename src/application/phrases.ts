import type { StepId } from '@domain/day/day-plan';
/**
 * Everything Lilo says that is not content of an activity or mission, by id:
 * the voice can be recorded later without touching the code that says it.
 * Short and warm. A wrong answer is never called "wrong".
 */
/** What the mascot says to lead to each step of the day. */
export const stepTips: Readonly<Record<StepId, string>> = {
  wake: 'Bom dia!',
  eat: 'Hora do café da manhã. Vamos para a mesa!',
  teeth: 'Agora vamos escovar os dentes.',
  dress: 'Vamos ao armário escolher a roupa.',
  backpack: 'Vamos arrumar a mochila na escrivaninha.',
  study: 'Hora de estudar. Vamos para a escrivaninha!',
  outside: 'Agora você pode sair para a rua. Vamos até a porta!',
  shower: 'Hora do banho!',
  pajamas: 'Vamos vestir o pijama.',
  sleep: 'Boa noite! Vamos para a cama.',
};

export const phrases = {
  goodMorning: (name: string) => `Bom dia, ${name}! Vamos levantar?`,
  firstWalk: 'Use a bolinha para andar. Siga as luzes até a mesa.',
  chooseFood: 'O que você quer comer?',
  foodChosen: (food: string) => `${food}! Vamos comer?`,
  mealDone: 'Hum! Que delícia!',
  teethPaste: 'Coloque a pasta na escova.',
  teethBrush: 'Agora escove bem.',
  teethRinse: 'Enxágue a boca.',
  teethDone: 'Dentes limpinhos!',
  handsSoap: 'Passe o sabonete nas mãos.',
  handsRinse: 'Enxágue com água.',
  handsDone: 'Mãos limpinhas!',
  showerWater: 'Abra o chuveiro.',
  showerSoap: 'Passe o sabonete.',
  showerRinse: 'Enxágue e feche o chuveiro.',
  showerDone: 'Banho tomado! Que cheirinho bom.',
  outfitForDay: 'Escolha a roupa de hoje e veja no espelho.',
  outfitForNight: 'Escolha o pijama e veja no espelho.',
  packList: 'Pegue o que vai na mochila hoje.',
  packed: (thing: string) => `${thing} na mochila.`,
  notToday: (thing: string) => `${thing} fica em casa hoje.`,
  packDone: 'Mochila pronta!',
  bedNotYet: 'Ainda não é hora de dormir.',
  deskFree: 'A escrivaninha está arrumada.',
  firstThis: (tip: string) => `Antes de sair: ${tip}`,
  nightStays: 'Já é noite. Hoje ficamos em casa.',
  blockDone: 'Muito bem! Essa parte do dia acabou.',
  goodNight: (name: string) => `Boa noite, ${name}. Durma bem.`,
  mapOutside: 'O mapa é da rua. Vamos vê-lo lá fora!',
  backHome: 'Chegamos em casa!',
  streetNotReady: 'A rua ainda não abriu. Tente de novo com internet.',
  outsideNow: 'Que dia bonito! Explore a rua.',
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
  goToPlace: (place: string) => `Vamos para: ${place}! Siga a seta amarela.`,
  goToStation: (place: string) => `Vamos até ${place}! Siga a seta.`,

  dayStart: 'Por onde vamos começar?',
  dayNext: 'O que vem agora?',
  dayAllDone: 'Você já fez tudo de hoje. Pode brincar à vontade!',
  dayEnd: 'Hoje você fez tudo isso! Até a próxima.',

  wardrobeOpen: 'Escolha uma roupa ou um personagem!',
  creatorWho: 'Vamos criar você! Quem é você?',
  creatorSkin: 'Escolha a cor da sua pele.',
  creatorHair: 'Escolha o seu cabelo.',
  creatorEyes: 'Escolha a cor dos seus olhos.',
  creatorGuardian: 'Quem cuida de você em casa?',
  childChanged: 'Pronto! Ficou a sua cara!',
  outfitWorn: (outfit: string) => `${outfit}! Roupa trocada.`,
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
  pauseOpen: 'Tudo bem. Vamos descansar um pouco.',
  pauseBack: 'Que bom que você voltou.',

  replyHello: 'Oi! Que bom te ver!',
  replyGoodDay: 'Oi! Tudo bem com você?',
} as const;
