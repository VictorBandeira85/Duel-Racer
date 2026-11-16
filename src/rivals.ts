// Fichas dos pilotos rivais da carreira: apelido, idade, cidade, história, falas antes da corrida, de
// vitória, de derrota e da revanche. O retrato é a arte `src/assets/rivals/rival-<id>.png` (fundo
// transparente); sem ela, um retrato provisório em pixel art é desenhado por código com as cores da ficha.
import type { Driver } from './career';

// aparência (retrato provisório e prompt da arte): pele, cabelo, roupa e acessórios
export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'curto' | 'longo' | 'rabo' | 'coque' | 'cacheado' | 'juba' | 'espetado' | 'topete' | 'careca' | 'raspado' | 'chanel' | 'moicano' | 'capacete';
  top: string; // cor da roupa
  topStyle: 'camisa' | 'jaqueta' | 'macacao' | 'regata' | 'farda' | 'terno' | 'casaco';
  hat?: { kind: 'bone' | 'chapeu' | 'palha' | 'quepe' | 'gorro' | 'faixa' | 'bandana' | 'capacete-obra' | 'tiara'; color: string };
  glasses?: 'escuro' | 'redondo' | 'aviador' | 'protecao' | 'monoculo';
  facial?: 'bigode' | 'barba' | 'cavanhaque' | 'barba-rala';
  earring?: string; // cor do brinco
  lips?: string; // batom
  scarf?: string; // lenço/cachecol no pescoço
}
export interface RivalProfile {
  id: string;
  name: string;
  nick: string;
  age: number | string;
  city: string;
  bio: [string, string];
  pre: string[]; // falas antes da corrida (a frase do evento vem primeiro)
  win: string; // quando o rival vence
  lose: string; // quando o rival perde
  rematch: string; // desafiando para a revanche
  look: Look;
  dress: string; // roupa e jeito, para o prompt do retrato
}

const P = (p: RivalProfile) => p;
export const RIVALS: RivalProfile[] = [
  // ---------- Costa do Sol ----------
  P({ id: 'dudu-pneu', name: 'Dudu Pneu', nick: 'Pneu', age: 19, city: 'Ubatuba/SP',
    bio: ['Borracheiro de dia e racha de noite: aprendeu a dirigir no Jornada da família.', 'Ainda trata o carro como se fosse de vidro.'],
    pre: ['Esse Jornada era do meu pai. Se riscar, eu choro.', 'Calibrei os pneus hoje cedo. Trinta libras, nem uma a mais.', 'Primeira corrida? A minha também foi assim, tremendo.'],
    win: 'Viu? Devagar e sempre. Pneu careca não ganha racha.', lose: 'Tá bom, tá bom... Vou ali calibrar meu orgulho.', rematch: 'Troquei os quatro pneus. Agora é diferente, pode vir.',
    look: { skin: '#c8906a', hair: '#1a1410', hairStyle: 'curto', top: '#2a5aa0', topStyle: 'macacao', hat: { kind: 'bone', color: '#d01818' } },
    dress: 'rapaz magro de 19 anos, macacão azul de borracheiro sujo de graxa, boné vermelho para trás, sorriso tímido' }),
  P({ id: 'lia-faisca', name: 'Lia Faísca', nick: 'Faísca', age: 22, city: 'Salvador/BA',
    bio: ['Eletricista formada, diz que liga um carro sem chave em dez segundos.', 'Corre pela adrenalina e nunca faz a mesma curva duas vezes.'],
    pre: ['Não me pergunte onde vou frear. Eu também não sei.', 'Meu Onça tem mais faísca que a fiação lá de casa.', 'Se eu sumir do retrovisor, foi de propósito.'],
    win: 'Zzzap! Curto-circuito na sua corrida.', lose: 'Ai, deu choque. Mas eu volto com a voltagem lá em cima.', rematch: 'Rebobinei a fita da corrida mil vezes. Agora eu sei o seu jeito.',
    look: { skin: '#e8b890', hair: '#c8501a', hairStyle: 'rabo', top: '#f0c000', topStyle: 'jaqueta', earring: '#ffe680' },
    dress: 'moça de 22 anos, cabelo ruivo preso em rabo de cavalo, jaqueta amarela de náilon com raio desenhado, brincos de argola, olhar travesso' }),
  P({ id: 'beto-turbo', name: 'Beto Turbo', nick: 'Turbo', age: 27, city: 'Santos/SP',
    bio: ['Mecânico de oficina de bairro, põe turbo até em liquidificador.', 'Fala alto, buzina mais alto ainda e odeia ficar atrás.'],
    pre: ['Ouviu esse assobio? É o meu turbo rindo de você.', 'Meu Passeio tem mais pressão que panela de feijoada.', 'Encosta que eu passo.'],
    win: 'Pssshhh! Esse foi o alívio da minha válvula.', lose: 'Foi a mangueira do turbo. Juro que foi a mangueira!', rematch: 'Mangueira nova, braçadeira nova. Bora de novo.',
    look: { skin: '#d8a070', hair: '#1a1410', hairStyle: 'topete', top: '#d01818', topStyle: 'camisa', facial: 'bigode' },
    dress: 'homem de 27 anos, topete com gel, bigode fino, camisa vermelha aberta no peito com corrente, cara de quem está gritando' }),
  P({ id: 'nina-maresia', name: 'Nina Maresia', nick: 'Maresia', age: 31, city: 'Florianópolis/SC',
    bio: ['Professora de geografia que conhece cada curva da costa pelo nome.', 'Planeja a corrida em caderno quadriculado, com régua e lápis.'],
    pre: ['Essa estrada tem 47 curvas. Eu contei duas vezes.', 'Com maresia na pista, quem é afobado vai para o mato.', 'Tire as mãos do rádio e ponha no volante.'],
    win: 'Nota dez para mim. Você fica de recuperação.', lose: 'Errei a conta. Vou refazer o caderno inteiro.', rematch: 'Caderno novo, curvas recalculadas. Prova surpresa!',
    look: { skin: '#f0c8a0', hair: '#6a4020', hairStyle: 'longo', top: '#18b8d0', topStyle: 'camisa', glasses: 'redondo' },
    dress: 'mulher de 31 anos, cabelo castanho comprido, óculos redondos, blusa turquesa de gola, lápis atrás da orelha, ar concentrado' }),
  P({ id: 'capitao-mare', name: 'Capitão Maré', nick: 'O Capitão', age: 45, city: 'Guarujá/SP',
    bio: ['Ex-pescador que trocou o barco por um Ímola e nunca perdeu na orla.', 'Dez anos invicto: sabe a maré e o horário de cada viatura.'],
    pre: ['Já afundei barco maior que esse seu carro.', 'Aqui o vento sopra a meu favor. Sempre soprou.', 'Pode olhar o mar à vontade. Vai ver só a minha traseira.'],
    win: 'Volte para a areia, marujo.', lose: 'Dez anos... A maré virou. Respeito, piloto.', rematch: 'Maré baixa não dura para sempre. Vim buscar a minha costa.',
    look: { skin: '#a86a40', hair: '#c8c8c0', hairStyle: 'curto', top: '#1f4fd0', topStyle: 'casaco', facial: 'barba', hat: { kind: 'quepe', color: '#f2f2f2' } },
    dress: 'homem de 45 anos, pele queimada de sol, barba grisalha cheia, quepe branco de capitão de barco, casaco azul-marinho de botões dourados, olhar duro' }),
  // ---------- Vale Verde ----------
  P({ id: 'ze-trator', name: 'Zé Trator', nick: 'Trator', age: 38, city: 'Rio Verde/GO',
    bio: ['Dono de sítio, puxa reboque de milho e racha no mesmo dia.', 'Mão pesada, pé mais pesado: o Savana dele já derrubou porteira.'],
    pre: ['Meu Savana já atolou e saiu sozinho. Imagina no asfalto.', 'Se encostar, quem amassa é você.', 'Na roça a gente acorda cedo. E corre cedo.'],
    win: 'Vai pra casa, que a vaca tá esperando.', lose: 'Uai... Perdi pra gente da cidade. Vou ter que contar pro compadre.', rematch: 'Tirei o barro do carro. Agora tá leve, sô.',
    look: { skin: '#c08050', hair: '#5a3a20', hairStyle: 'curto', top: '#5a7a3a', topStyle: 'camisa', facial: 'bigode', hat: { kind: 'palha', color: '#d8c070' } },
    dress: 'homem forte de 38 anos, chapéu de palha, bigode grosso, camisa xadrez verde de manga dobrada, mãos grandes, sorriso de lado' }),
  P({ id: 'rosa-vento', name: 'Rosa Vento', nick: 'Rosa', age: 29, city: 'Holambra/SP',
    bio: ['Cultiva flores e coleciona elogios pela educação na estrada.', 'Faz cada curva no traçado perfeito, como quem poda roseira.'],
    pre: ['Curva é igual roseira: quem pega com pressa se espeta.', 'Meu cupê tem perfume de lavanda e cheiro de vitória.', 'Pode ir na frente. Eu te pego na curva.'],
    win: 'Uma rosa para o vencedor. No caso, eu.', lose: 'Tudo bem. Até rosa tem espinho.', rematch: 'Podei o motor, aparei as rodas. Desta vez eu floresço.',
    look: { skin: '#e0a888', hair: '#1a1410', hairStyle: 'longo', top: '#7a3ac8', topStyle: 'casaco', earring: '#e04080' },
    dress: 'mulher de 29 anos, cabelo preto liso comprido com uma rosa vermelha presa atrás da orelha, casaquinho roxo, sorriso calmo e confiante' }),
  P({ id: 'tico-nitro', name: 'Tico Nitro', nick: 'Nitro', age: 20, city: 'Caxias do Sul/RS',
    bio: ['Inventor de garagem, já tentou pôr foguete numa bicicleta.', 'Ninguém sabe o que tem debaixo do capô do Onça. Nem ele.'],
    pre: ['Apertei um botão novo hoje. Não sei para que serve.', 'Se sair fumaça verde, é normal. Acho.', 'Meu plano é não ter plano.'],
    win: 'Funcionou! Nem acredito que funcionou!', lose: 'Opa, faltou um parafuso. Ou sobrou um. Sei lá.', rematch: 'Botão novo, fio novo, ideia nova. Bora testar em você.',
    look: { skin: '#f0c8a0', hair: '#e8c040', hairStyle: 'espetado', top: '#f0c000', topStyle: 'macacao', glasses: 'protecao' },
    dress: 'rapaz de 20 anos, cabelo loiro espetado e chamuscado, óculos de soldador na testa, macacão amarelo com manchas de óleo, cara de cientista maluco animado' }),
  P({ id: 'marta-freio', name: 'Marta Freio', nick: 'Dona Marta', age: 52, city: 'Gramado/RS',
    bio: ['Instrutora de autoescola há trinta anos, nunca errou uma baliza.', 'Corre de luvas, com o banco no lugar e o cinto bem apertado.'],
    pre: ['Retrovisor ajustado? Cinto afivelado? Então pode perder.', 'Já reprovei gente mais rápida que você.', 'Mãos às dez e dez, mocinho.'],
    win: 'Reprovado. Marque outra aula.', lose: 'Aprovado. Mas tire o pé na serra, viu?', rematch: 'Aula de reforço. Hoje eu cobro a matéria toda.',
    look: { skin: '#f0d0b0', hair: '#b8b8b0', hairStyle: 'coque', top: '#8a8c92', topStyle: 'casaco', glasses: 'redondo' },
    dress: 'senhora de 52 anos, cabelo grisalho em coque, óculos de armação fina, cardigã cinza com broche, expressão severa de professora' }),
  P({ id: 'barao-do-vale', name: 'Barão do Vale', nick: 'O Barão', age: 58, city: 'Ribeirão Preto/SP',
    bio: ['Fazendeiro de café que manda na estrada como manda na colheita.', 'Corre de terno, chapéu e anel de ouro. Nunca pediu licença.'],
    pre: ['Essa estrada foi asfaltada com o meu dinheiro.', 'Peão não ultrapassa patrão.', 'Meu motorista tirou folga. Hoje dirijo eu.'],
    win: 'Ponha-se no seu lugar: atrás.', lose: 'Hmpf. Leve o prêmio e saia das minhas terras.', rematch: 'Comprei a revanche. Aqui tudo tem preço.',
    look: { skin: '#e8b890', hair: '#9a9a94', hairStyle: 'curto', top: '#1c1c20', topStyle: 'terno', facial: 'bigode', hat: { kind: 'chapeu', color: '#2a2420' } },
    dress: 'homem de 58 anos, chapéu de feltro escuro, bigode grisalho bem aparado, terno preto com gravata vermelha, anel de ouro, olhar arrogante' }),
  // ---------- Trópico Selvagem ----------
  P({ id: 'surfista-leo', name: 'Surfista Léo', nick: 'Léo', age: 24, city: 'Itacaré/BA',
    bio: ['Campeão de surfe amador que vende parafina na beira da estrada.', 'Pilota relaxado, de chinelo, e acha a reta igual a onda boa.'],
    pre: ['Fica tranquilo, brother. É só uma corrida.', 'Pego a curva igual pego tubo: deitado.', 'Meu Corsário tem cheiro de parafina e protetor solar.'],
    win: 'Altas ondas, brother! Valeu a sessão.', lose: 'Caldo. Faz parte, brother.', rematch: 'O mar tá de ressaca e eu também. Revanche, brother?',
    look: { skin: '#b87848', hair: '#e0c070', hairStyle: 'longo', top: '#18b8d0', topStyle: 'regata', glasses: 'escuro' },
    dress: 'rapaz bronzeado de 24 anos, cabelo loiro queimado de sol comprido, óculos escuros, regata turquesa, colar de conchinhas, sorriso relaxado' }),
  P({ id: 'juba', name: 'Juba', nick: 'Juba', age: 33, city: 'Campo Grande/MS',
    bio: ['Guia de safári fotográfico com uma cabeleira digna de leão.', 'Ruge no volante e trata cada ultrapassagem como caçada.'],
    pre: ['Sente o cheiro? É medo. O seu.', 'Na savana não tem faixa. Nem freio.', 'Grrr. Isso foi o motor ou fui eu?'],
    win: 'Roooar! A savana tem um rei só.', lose: 'Até leão perde uma caçada. A próxima é minha.', rematch: 'O leão voltou com fome.',
    look: { skin: '#8a5a3a', hair: '#3a2010', hairStyle: 'juba', top: '#c8a840', topStyle: 'camisa', facial: 'barba' },
    dress: 'homem de 33 anos, cabeleira volumosa como juba de leão, barba cheia, camisa cáqui de safári com bolsos, binóculo no pescoço, expressão de rugido' }),
  P({ id: 'tucano', name: 'Tucano', nick: 'Tucano', age: 26, city: 'Manaus/AM',
    bio: ['Barqueiro do rio que aprendeu a correr nas estradas de terra da mata.', 'Some na neblina e reaparece onde ninguém espera.'],
    pre: ['Chuva na selva? Para mim é chuveiro.', 'Meu Unão é pequeno, mas o bico é grande.', 'Escuta a mata. Ela torce por mim.'],
    win: 'A mata escolheu. Fui eu.', lose: 'Ê, rapaz... Até tucano escorrega em galho molhado.', rematch: 'Voltei pelo rio, pela estrada e pela mata. Bora.',
    look: { skin: '#9a6040', hair: '#1a1410', hairStyle: 'curto', top: '#1a9a3a', topStyle: 'camisa', hat: { kind: 'bandana', color: '#f08020' } },
    dress: 'rapaz de 26 anos, cabelo preto liso, bandana laranja na cabeça, camiseta verde molhada de chuva, sorriso esperto' }),
  P({ id: 'coiote', name: 'Coiote', nick: 'Coiote', age: 35, city: 'Petrolina/PE',
    bio: ['Caminhoneiro aposentado que vive caçando o carro mais rápido do cânion.', 'Já caiu em todo tipo de armadilha, mas nunca desiste da presa.'],
    pre: ['Desta vez eu comprei um plano infalível.', 'Conheço cada pedra desse cânion. Algumas eu mesmo derrubei.', 'Pode correr. Coiote não cansa.'],
    win: 'Finalmente! Peguei o papa-léguas!', lose: 'Plano infalível número 47... falhou de novo.', rematch: 'Plano 48. Este é infalível de verdade.',
    look: { skin: '#c88050', hair: '#6a4020', hairStyle: 'curto', top: '#c8603a', topStyle: 'jaqueta', facial: 'cavanhaque', hat: { kind: 'bone', color: '#8a4020' } },
    dress: 'homem magro de 35 anos, boné marrom surrado, cavanhaque, jaqueta jeans laranja-ferrugem, olheiras e sorriso de quem tem um plano mirabolante' }),
  P({ id: 'rainha-jaci', name: 'Rainha Jaci', nick: 'A Rainha', age: 41, city: 'Belém/PA',
    bio: ['Dona da maior frota de barcos-táxi do Norte e invicta no Trópico.', 'Pilota com elegância, joias e um sorriso que dá medo.'],
    pre: ['Ajoelhe-se ou acelere. De preferência os dois.', 'Coroa não se ganha. Se defende.', 'Meu Vetor tem mais estrada que você tem de vida.'],
    win: 'A coroa continua onde sempre esteve.', lose: 'Uma rainha sabe perder... uma vez.', rematch: 'Uma rainha não esquece. Vim retomar o trono.',
    look: { skin: '#7a4a2a', hair: '#1a1410', hairStyle: 'cacheado', top: '#f0a030', topStyle: 'casaco', earring: '#ffd21a', hat: { kind: 'tiara', color: '#ffd21a' } },
    dress: 'mulher de 41 anos, cabelo cacheado volumoso, tiara dourada discreta, brincos grandes de ouro, blazer laranja com ombreiras, olhar majestoso' }),
  // ---------- Rota do Deserto ----------
  P({ id: 'sol-escaldante', name: 'Sol Escaldante', nick: 'Sol', age: 28, city: 'Juazeiro/BA',
    bio: ['Vendedor de picolé que atravessa o sertão sem ar-condicionado.', 'Diz que o calor do asfalto deixa o motor dele mais bravo.'],
    pre: ['Quarenta e cinco graus na sombra. Ótimo dia para correr.', 'Meu radiador é feito de pura teimosia.', 'Bebe água, novato. Vai suar.'],
    win: 'Torrou, né? Vai um picolé?', lose: 'Derreti. Igual picolé no painel.', rematch: 'Agora com garrafa térmica e raiva gelada.',
    look: { skin: '#a86838', hair: '#1a1410', hairStyle: 'raspado', top: '#f0c000', topStyle: 'regata', glasses: 'escuro' },
    dress: 'homem de 28 anos, cabeça raspada suada, óculos escuros espelhados, regata amarela, toalha no ombro, sorriso largo' }),
  P({ id: 'kiko-poeira', name: 'Kiko Poeira', nick: 'Poeira', age: 23, city: 'Mossoró/RN',
    bio: ['Piloto de rali de terra que vive coberto de pó da cabeça aos pés.', 'Corta caminho pelo acostamento e chega sorrindo, cheio de areia.'],
    pre: ['Asfalto é chato. Mas eu me viro.', 'Se não enxergar nada, é porque eu tô na frente.', 'Meu ar-condicionado é a janela aberta.'],
    win: 'Comeu poeira, hein? Cof, cof.', lose: 'Areia no carburador. De novo.', rematch: 'Lavei o carro. Primeira vez no ano. Revanche!',
    look: { skin: '#d8a070', hair: '#a07a4a', hairStyle: 'espetado', top: '#d8c49a', topStyle: 'macacao', glasses: 'protecao', scarf: '#c8603a' },
    dress: 'rapaz de 23 anos, cabelo castanho claro bagunçado e empoeirado, óculos de proteção na testa, lenço no pescoço, macacão de rali bege sujo de terra' }),
  P({ id: 'vera-lua', name: 'Vera Lua', nick: 'Lua', age: 34, city: 'Lençóis/BA',
    bio: ['Astrônoma de observatório, só corre depois que as estrelas aparecem.', 'Calcula as curvas pela posição da lua e quase nunca erra.'],
    pre: ['Lua crescente: ótima para ultrapassar.', 'Olhe para o céu. Eu vou estar lá na frente.', 'A estrada à noite tem menos gente. E menos desculpas.'],
    win: 'Estava escrito nas estrelas.', lose: 'Eclipse total. Acontece.', rematch: 'Os astros se alinharam de novo. A meu favor.',
    look: { skin: '#e8c0a0', hair: '#1a1410', hairStyle: 'chanel', top: '#7a3ac8', topStyle: 'casaco', earring: '#d8dce2' },
    dress: 'mulher de 34 anos, cabelo preto em corte chanel com franja, brincos prateados em forma de lua, casaco roxo escuro com estrelinhas bordadas, olhar sereno' }),
  P({ id: 'tenente-brasa', name: 'Tenente Brasa', nick: 'Brasa', age: 39, city: 'Petrolina/PE',
    bio: ['Policial rodoviário que conhece o deserto melhor que o próprio quintal.', 'Topou correr contra você para provar que a lei também é rápida.'],
    pre: ['Documento do carro e habilitação. Depois a gente corre.', 'Se eu ganhar, você paga o café. E a multa.', 'Sirene desligada. Por enquanto.'],
    win: 'Pode encostar. Ganhei e ainda multo.', lose: 'Hoje passou. Mas eu anotei a placa.', rematch: 'A placa que eu anotei? Vim cobrar pessoalmente.',
    look: { skin: '#9a6040', hair: '#1a1410', hairStyle: 'curto', top: '#5a6a7a', topStyle: 'farda', facial: 'bigode', glasses: 'aviador', hat: { kind: 'quepe', color: '#2a3a5a' } },
    dress: 'policial rodoviário de 39 anos, quepe azul-escuro sem brasão real, óculos aviador, bigode, farda cinza-azulada com distintivo genérico, cara séria' }),
  P({ id: 'escorpiao', name: 'Escorpião', nick: 'Escorpião', age: 44, city: 'Cabrobó/PE',
    bio: ['Lenda das retas do sertão: ninguém sabe o nome verdadeiro dele.', 'Tatuagem de escorpião no braço e um ferrão no pé direito.'],
    pre: ['No deserto, quem para morre de sede.', 'Meu ferrão é o pé direito.', 'Já piquei muita gente antes de você.'],
    win: 'Picada certeira. Fica aí no sol.', lose: 'O veneno falhou hoje. Só hoje.', rematch: 'Troquei a casca. O veneno tá mais forte.',
    look: { skin: '#b07040', hair: '#1a1410', hairStyle: 'careca', top: '#1c1c20', topStyle: 'jaqueta', facial: 'cavanhaque', glasses: 'escuro' },
    dress: 'homem de 44 anos, careca, cavanhaque preto, óculos escuros, jaqueta de couro preta, tatuagem de escorpião subindo pelo pescoço, sorriso frio' }),
  // ---------- Metrópole ----------
  P({ id: 'taxi-veloz', name: 'Táxi Veloz', nick: 'Taxista', age: 47, city: 'São Paulo/SP',
    bio: ['Taxista que envenenou o carro para ir ao aeroporto em nove minutos.', 'Sabe todo atalho da cidade e não liga o taxímetro para rival.'],
    pre: ['Bandeira dois, que hoje é feriado!', 'Conheço um atalho. Você não.', 'Senta aí atrás, que eu te mostro a cidade em três minutos.'],
    win: 'Deu a corrida, passageiro. Aceita cheque?', lose: 'Pegou trânsito, né? Eu também. Fica a gorjeta.', rematch: 'Taxímetro zerado. Esta corrida é por minha conta.',
    look: { skin: '#d8a070', hair: '#9a9a94', hairStyle: 'curto', top: '#ececec', topStyle: 'camisa', facial: 'bigode', hat: { kind: 'bone', color: '#f0c000' } },
    dress: 'homem de 47 anos, boné amarelo de taxista, bigode grisalho, camisa branca de manga curta com caneta no bolso, palito no canto da boca' }),
  P({ id: 'dani-neon', name: 'Dani Neon', nick: 'Neon', age: 25, city: 'Rio de Janeiro/RJ',
    bio: ['DJ de boate que só sai de casa depois da meia-noite.', 'Carro rebaixado, neon embaixo e uma fita cassete para cada corrida.'],
    pre: ['Escolhi a fita perfeita para te ultrapassar.', 'Na avenida eu brilho. Literalmente.', 'Fica no ritmo: tum-tss, tum-tss.'],
    win: 'E aí, gostou do set? Bis!', lose: 'Arranhou o disco. Mas a festa continua.', rematch: 'Remix da corrida. Volume no máximo.',
    look: { skin: '#c89070', hair: '#e040a0', hairStyle: 'moicano', top: '#18b8d0', topStyle: 'jaqueta', glasses: 'escuro', earring: '#40f0e0' },
    dress: 'pessoa de 25 anos, cabelo rosa-choque com laterais raspadas, óculos escuros estreitos, jaqueta corta-vento turquesa e roxa, fones de ouvido grandes no pescoço' }),
  P({ id: 'capita-sirene', name: 'Capitã Sirene', nick: 'Sirene', age: 36, city: 'São Paulo/SP',
    bio: ['Comandante da patrulha de alta velocidade, a mais rápida da corporação.', 'Corre fora do expediente para treinar. E dentro também.'],
    pre: ['Meu carro de folga é mais rápido que a viatura. Quase.', 'Velocidade máxima da via? Para você é lei. Para mim, treino.', 'Mãos onde eu possa ver: no volante.'],
    win: 'Perdeu, piloto. Encosta o carro.', lose: 'Bom de volante. Mas eu tô de olho em você.', rematch: 'Treinei. Você não tem mais desculpa.',
    look: { skin: '#e0b088', hair: '#1a1410', hairStyle: 'coque', top: '#2a3a5a', topStyle: 'farda', glasses: 'aviador', hat: { kind: 'quepe', color: '#1a2a4a' } },
    dress: 'policial de 36 anos, cabelo preso em coque, quepe azul-marinho sem brasão real, óculos aviador espelhados, farda azul-escura com distintivo genérico, meio sorriso desafiador' }),
  P({ id: 'iara-tormenta', name: 'Iara Tormenta', nick: 'Tormenta', age: 30, city: 'Curitiba/PR',
    bio: ['Moça do tempo na TV, só corre quando a previsão é de chuva.', 'Diz que ouve o trovão e sabe para onde o carro vai escorregar.'],
    pre: ['Previsão para hoje: você atrás de mim.', 'Cem por cento de chance de aquaplanagem. Para você.', 'Raio não cai duas vezes. Eu caio quantas quiser.'],
    win: 'Previsão confirmada.', lose: 'Frente fria. Vou me recolher.', rematch: 'Novo ciclone se aproximando: eu.',
    look: { skin: '#f0c8a0', hair: '#2a2a3a', hairStyle: 'longo', top: '#1f4fd0', topStyle: 'casaco', lips: '#c02040' },
    dress: 'mulher de 30 anos, cabelo escuro comprido e ondulado, batom vermelho, capa de chuva azul brilhante com gola alta, gotas de chuva no rosto, sorriso de apresentadora' }),
  P({ id: 'dama-da-noite', name: 'Dama da Noite', nick: 'A Dama', age: 38, city: 'São Paulo/SP',
    bio: ['Dona de uma rede de casas noturnas e rainha das avenidas de madrugada.', 'Nunca foi vista de dia. Dizem que dorme dentro do Fúria.'],
    pre: ['A cidade é um tabuleiro. Você é peão.', 'Luvas de couro, batom vermelho, motor quente.', 'Às três da manhã as avenidas são só minhas.'],
    win: 'Boa noite, querido. Durma bem.', lose: 'Amanheceu para mim. Que deselegante.', rematch: 'A noite voltou. E eu com ela.',
    look: { skin: '#f0d0b8', hair: '#1a1410', hairStyle: 'chanel', top: '#d01818', topStyle: 'jaqueta', lips: '#b01020', earring: '#ececec' },
    dress: 'mulher elegante de 38 anos, cabelo preto em chanel liso e brilhante, batom vermelho-escuro, brincos de pérola, jaqueta de couro vermelha de gola alta, olhar misterioso' }),
  // ---------- Fronteira Norte ----------
  P({ id: 'outonal', name: 'Outonal', nick: 'Outonal', age: 50, city: 'Campos do Jordão/SP',
    bio: ['Poeta e professor de piano que só corre na estação das folhas.', 'Recita versos no rádio do carro enquanto faz as curvas.'],
    pre: ['As folhas caem, o ponteiro sobe.', 'Cada reta é uma estrofe. Cada curva, uma rima.', 'Silêncio. Estou compondo a próxima curva.'],
    win: 'Fim do poema. Rima perfeita.', lose: 'Uma folha a menos. A árvore continua.', rematch: 'Escrevi um soneto sobre a revanche. Quatorze curvas.',
    look: { skin: '#e8c0a0', hair: '#a85a2a', hairStyle: 'longo', top: '#7a4a2a', topStyle: 'terno', facial: 'barba', glasses: 'redondo', scarf: '#d07a2a' },
    dress: 'homem de 50 anos, cabelo ruivo grisalho até os ombros, barba, óculos redondos, paletó de tweed marrom, cachecol laranja, uma folha seca presa na lapela' }),
  P({ id: 'operario', name: 'Operário', nick: 'Operário', age: 42, city: 'Volta Redonda/RJ',
    bio: ['Metalúrgico do turno da noite que montou o Toro peça por peça.', 'Sai da fábrica com graxa nas mãos e vai direto para a avenida.'],
    pre: ['Esse motor eu montei de olho fechado.', 'Doze horas de turno e ainda tenho pé para você.', 'Hora extra é ganhar de você.'],
    win: 'Serviço feito. Pode desligar a máquina.', lose: 'Peça com defeito. Vou abrir reclamação.', rematch: 'Peças novas, turno dobrado. Bora.',
    look: { skin: '#9a6040', hair: '#1a1410', hairStyle: 'curto', top: '#3a4a6a', topStyle: 'macacao', facial: 'bigode', hat: { kind: 'capacete-obra', color: '#f0c000' } },
    dress: 'homem robusto de 42 anos, capacete de obra amarelo, bigode grosso, macacão azul de metalúrgico com graxa, rosto suado e determinado' }),
  P({ id: 'fantasma', name: 'Fantasma', nick: 'Fantasma', age: '??', city: 'desconhecida',
    bio: ['Ninguém nunca viu o rosto dele: só ouviu o ronco na neblina.', 'Dizem que é um piloto de 1970 que nunca voltou para casa.'],
    pre: ['Buuu. Brincadeira. Ou não.', 'Já corri nesta estrada antes de ela existir.', 'Não adianta olhar o retrovisor.'],
    win: 'Sumiu de novo? Era eu.', lose: 'A neblina me traiu. Ela vai voltar.', rematch: 'Achou que eu tinha ido embora?',
    look: { skin: '#d8d8d8', hair: '#ececec', hairStyle: 'capacete', top: '#d8dce2', topStyle: 'macacao', scarf: '#ececec' },
    dress: 'piloto misterioso de capacete fechado branco antigo com viseira escura (sem rosto à mostra), macacão branco de corrida dos anos 70 sem patrocínio, névoa em volta' }),
  P({ id: 'aguia', name: 'Águia', nick: 'Águia', age: 37, city: 'Urubici/SC',
    bio: ['Ex-piloto de asa-delta que trocou o céu pelas estradas de penhasco.', 'Faz as curvas na beira do abismo sem tirar o pé.'],
    pre: ['Guard-rail é para quem tem medo de voar.', 'Já caí de quinhentos metros. Isto aqui é brincadeira.', 'Do alto, você parece uma formiga.'],
    win: 'Visão de águia, piloto.', lose: 'Corrente de vento contrária. Acontece.', rematch: 'Voltei a voar. Cuidado com a sombra.',
    look: { skin: '#c88858', hair: '#5a3a20', hairStyle: 'curto', top: '#7a4a2a', topStyle: 'jaqueta', glasses: 'aviador', scarf: '#ececec' },
    dress: 'homem de 37 anos, cabelo castanho curto ao vento, óculos aviador, jaqueta de couro marrom de aviador com gola de lã, lenço branco no pescoço, olhar afiado' }),
  P({ id: 'barao-gelido', name: 'Barão Gélido', nick: 'O Barão', age: 61, city: 'Monte Verde/MG',
    bio: ['Aristocrata de família europeia, dono de um hotel de esqui na serra.', 'Frio como gelo, corre de luvas brancas e monóculo.'],
    pre: ['Pegue um chocolate quente. Vai precisar.', 'Meus avós já corriam quando aqui era trilha de mula.', 'Lá em cima, cada respiração custa caro.'],
    win: 'Congelou? Natural.', lose: 'Inaceitável... Mas bem pilotado.', rematch: 'Mandei afiar as correntes. E o orgulho.',
    look: { skin: '#f0d8c8', hair: '#f0f0f0', hairStyle: 'curto', top: '#2a3a5a', topStyle: 'casaco', facial: 'bigode', glasses: 'monoculo', scarf: '#6aa0d0' },
    dress: 'aristocrata de 61 anos, cabelo branco penteado para trás, bigode branco encerado, monóculo, casaco azul-marinho de gola de pele, cachecol azul-gelo, nariz empinado' }),
  // ---------- Cume Gelado ----------
  P({ id: 'ulf-gelo', name: 'Ulf Gelo', nick: 'Ulf', age: 34, city: 'São Joaquim/SC',
    bio: ['Filho de imigrantes nórdicos, instrutor de direção na neve.', 'Fala pouco e corre menos ainda: deixa os outros errarem.'],
    pre: ['Pneu frio, cabeça fria.', 'Ja. Vamos.', 'Na neve, o volante é delicado. Como você.'],
    win: 'Ja. Gelo é casa.', lose: 'Hm. Bom.', rematch: 'Mais neve hoje. Bom para mim.',
    look: { skin: '#f8e0d0', hair: '#f0e0a0', hairStyle: 'longo', top: '#3a5a8a', topStyle: 'casaco', facial: 'barba', hat: { kind: 'gorro', color: '#ececec' } },
    dress: 'homem alto de 34 anos, cabelo loiro claro comprido, barba loira, gorro de lã branco, casaco azul acolchoado, bochechas vermelhas de frio, expressão impassível' }),
  P({ id: 'paulo-penhasco', name: 'Paulo Penhasco', nick: 'Penhasco', age: 40, city: 'Lauro Müller/SC',
    bio: ['Guia de escalada que sobe a serra de carro mais rápido que de corda.', 'Coleciona sustos e arranhões, mas nunca perdeu uma descida.'],
    pre: ['Mosquetão no cinto, pé no fundo.', 'Aqui a curva tem trezentos metros de queda. Boa sorte.', 'Escalei pior que você hoje de manhã.'],
    win: 'Topo conquistado. Bandeira fincada.', lose: 'Escorreguei na via. Corda nova e eu volto.', rematch: 'Via nova aberta. Grau de dificuldade: você.',
    look: { skin: '#d09060', hair: '#5a3a20', hairStyle: 'cacheado', top: '#d81a12', topStyle: 'jaqueta', facial: 'barba-rala', hat: { kind: 'faixa', color: '#f0c000' } },
    dress: 'homem de 40 anos, cabelo castanho cacheado com faixa amarela na testa, barba por fazer, jaqueta corta-vento vermelha, corda de escalada no ombro, sorriso aventureiro' }),
  P({ id: 'lobo-solitario', name: 'Lobo Solitário', nick: 'Lobo', age: 46, city: 'Bom Jardim da Serra/SC',
    bio: ['Motoqueiro que trocou a moto por um Silber e nunca tirou a jaqueta.', 'Não tem amigos, não tem equipe, não tem adesivo no para-choque.'],
    pre: ['Ando sozinho. Sempre andei.', 'A lua cheia me deixa mais rápido.', 'Matilha? Não preciso.'],
    win: 'Auuuuu!', lose: 'Até o lobo perde a presa às vezes.', rematch: 'Uivei para a lua a semana toda. Ela respondeu.',
    look: { skin: '#c89070', hair: '#8a8a84', hairStyle: 'longo', top: '#1c1c20', topStyle: 'jaqueta', facial: 'barba', glasses: 'escuro' },
    dress: 'homem de 46 anos, cabelo grisalho comprido, barba grisalha, óculos escuros redondos, jaqueta de couro preta surrada com emblema de lobo uivando, cara fechada' }),
  P({ id: 'rei-da-serra', name: 'Rei da Serra', nick: 'O Rei', age: 55, city: 'Serra Gelada/SC',
    bio: ['Campeão de subida de montanha nos anos 70, nunca perdeu no Cume.', 'Vive recluso na serra, esperando alguém digno do desafio.'],
    pre: ['Faz vinte anos que espero alguém como você.', 'Esta serra tem dono. E ele está na sua frente.', 'Respire fundo. O ar aqui em cima é meu.'],
    win: 'A coroa da serra fica onde está.', lose: 'Enfim... um novo rei. A serra é sua.', rematch: 'Rei destronado não dorme. Vim pela coroa.',
    look: { skin: '#d8a880', hair: '#e8e8e4', hairStyle: 'curto', top: '#f0c000', topStyle: 'macacao', facial: 'barba', scarf: '#d01818' },
    dress: 'homem de 55 anos, cabelo e barba brancos bem aparados, macacão de corrida amarelo vintage dos anos 70 sem patrocínio, lenço vermelho no pescoço, luvas de couro, olhar de lenda' }),
];

export const rivalSlug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const BY_ID = new Map(RIVALS.map((r) => [r.id, r]));
// ficha do piloto do evento (piloto sem ficha: uma genérica, para nada quebrar)
export function rivalOf(d: Driver): RivalProfile {
  const id = rivalSlug(d.name);
  return BY_ID.get(id) ?? {
    id, name: d.name, nick: d.name, age: '??', city: 'em algum lugar', bio: ['Piloto de racha das estradas.', 'Pouco se sabe sobre ele.'], pre: [],
    win: 'Mais sorte da próxima vez.', lose: 'Bem pilotado.', rematch: 'Quero revanche.', dress: '',
    look: { skin: '#d8a070', hair: '#1a1410', hairStyle: 'curto', top: d.paint, topStyle: 'jaqueta' },
  };
}
export const portraitId = (d: Driver) => `rival-${rivalOf(d).id}`;
// fala antes da corrida: a frase do evento e depois as da ficha, mudando a cada tentativa
export function preLine(d: Driver, attempt: number) {
  const lines = [d.quote, ...rivalOf(d).pre];
  return lines[attempt % lines.length];
}

// ---------- retrato ----------
const PORTRAITS = import.meta.glob('./assets/rivals/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const imgs = new Map<string, HTMLImageElement | null>();
function portraitImg(id: string): HTMLImageElement | null {
  if (!imgs.has(id)) {
    const src = PORTRAITS[`./assets/rivals/${id}.png`];
    if (!src) imgs.set(id, null);
    else {
      const im = new Image();
      im.src = src;
      imgs.set(id, im);
    }
  }
  const im = imgs.get(id);
  return im && im.complete && im.naturalWidth ? im : null;
}

// mistura de cores (hex) para sombras e luzes do retrato provisório
function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const shadeC = (c: string, k: number) => mix(c, k < 0 ? '#000000' : '#ffffff', Math.abs(k));

// Retrato provisório em pixel art (32 x 36 pixels): busto em 3/4, fundo na cor do carro, com o
// cabelo, a roupa e os acessórios da ficha. Fica em cache por piloto.
const PW = 32, PH = 36;
const pixCache = new Map<string, HTMLCanvasElement>();
function pixelPortrait(p: RivalProfile, bg: string): HTMLCanvasElement {
  const key = `${p.id}|${bg}`;
  const hit = pixCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = PW;
  cv.height = PH;
  const g = cv.getContext('2d')!;
  const L = p.look;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // fundo: cor do carro escurecida, com faixas de meio-tom de revista
  px(0, 0, PW, PH, shadeC(bg, -0.35));
  for (let y = 0; y < PH; y += 3) px(0, y, PW, 1, shadeC(bg, -0.2));
  px(0, PH - 10, PW, 10, shadeC(bg, -0.5));
  // elipse em pixels (linha a linha), com a borda escura
  const ellipse = (cx: number, cy: number, rx: number, ry: number, col: string, y0 = -99, y1 = 99) => {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      if (y < y0 || y > y1) continue;
      const dx = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
      px(Math.round(cx - dx), y, Math.max(1, Math.round(dx * 2)), 1, col);
    }
  };
  const skin = L.skin, skinD = shadeC(skin, -0.22), skinL = shadeC(skin, 0.15);
  const top = L.top, topD = shadeC(top, -0.3), topL = shadeC(top, 0.18);
  const hair = L.hair, hairD = shadeC(hair, -0.3), hairL = shadeC(hair, 0.2);
  const OUT = '#14100e';
  const helmetOnly = L.hairStyle === 'capacete';
  // cabelo comprido atrás dos ombros
  if (L.hairStyle === 'longo' || L.hairStyle === 'juba' || L.hairStyle === 'cacheado') {
    const w = L.hairStyle === 'juba' ? 12 : L.hairStyle === 'cacheado' ? 11 : 9;
    // só até o queixo no meio (senão parece barba); dos lados desce até os ombros
    ellipse(15, 15, w, 13, OUT, -99, 20);
    ellipse(15, 15, w - 1, 12, hairD, -99, 20);
    px(16 - w, 20, 4, 7, hairD);
    px(13 + w, 20, 4, 7, hairD);
    if (L.hairStyle !== 'longo') for (let k = 0; k < 14; k++) px(3 + ((k * 7) % 24), 6 + ((k * 5) % 18), 2, 2, hair);
  }
  // ombros e tronco (3/4: o ombro esquerdo mais à frente)
  for (let y = 26; y < PH; y++) {
    const t = (y - 26) / (PH - 26);
    const x0 = Math.round(6 - t * 6), x1 = Math.round(27 + t * 5);
    px(x0, y, x1 - x0, 1, top);
    px(x0, y, 1, 1, OUT);
    px(x1 - 1, y, 1, 1, OUT);
    px(x1 - 6, y, 5, 1, topD); // lado na sombra
  }
  px(6, 26, 21, 1, OUT);
  px(8, 27, 6, 1, topL); // luz no ombro
  // pescoço
  px(13, 22, 6, 5, skinD);
  px(13, 22, 3, 5, skin);
  // gola / roupa
  if (L.topStyle === 'terno' || L.topStyle === 'farda' || L.topStyle === 'casaco') {
    px(12, 27, 8, 1, '#f2f2f2');
    for (let y = 27; y < PH; y++) {
      const d = Math.min(5, y - 27);
      px(16 - d, y, 1, 1, topD);
      px(16 + d, y, 1, 1, topD);
    }
    if (L.topStyle === 'terno') {
      px(14, 27, 4, 3, '#f2f2f2');
      px(15, 28, 2, 6, '#c01818'); // gravata
    }
    if (L.topStyle === 'farda') { px(9, 30, 3, 2, '#d8c040'); px(21, 30, 3, 2, '#c8c8c8'); }
    if (L.topStyle === 'casaco') for (let y = 30; y < PH; y += 3) px(16, y, 1, 1, '#ffd21a');
  } else if (L.topStyle === 'regata') {
    px(10, 26, 12, 3, skin);
    px(8, 26, 2, PH - 26, skin);
    px(23, 26, 3, PH - 26, skinD);
  } else if (L.topStyle === 'jaqueta') {
    px(11, 26, 3, 3, topL);
    px(18, 26, 3, 3, topD);
    for (let y = 28; y < PH; y++) px(16, y, 1, 1, shadeC(top, -0.5)); // zíper
  } else if (L.topStyle === 'macacao') {
    px(13, 27, 6, 2, skinD);
    px(9, 31, 4, 3, topL); // bolso
    for (let y = 29; y < PH; y++) px(16, y, 1, 1, topD);
  } else {
    px(13, 27, 6, 2, skin);
    px(12, 27, 1, 3, topL);
    px(19, 27, 1, 3, topL);
  }
  if (L.scarf) {
    px(11, 24, 11, 3, L.scarf);
    px(11, 26, 11, 1, shadeC(L.scarf, -0.3));
    px(18, 27, 3, 4, L.scarf);
  }
  if (helmetOnly) {
    // capacete fechado antigo, viseira escura: rosto nenhum
    ellipse(16, 14, 9, 10, OUT);
    ellipse(16, 14, 8, 9, hair);
    ellipse(17, 12, 5, 4, hairL, 7, 9);
    px(9, 13, 15, 6, '#1a1e26');
    px(10, 14, 5, 1, '#5a6a8a');
    px(8, 19, 17, 1, OUT);
    px(9, 20, 15, 3, shadeC(hair, -0.15));
  } else {
    // cabeça
    ellipse(15.5, 14, 7.5, 9, OUT);
    ellipse(15.5, 14, 6.5, 8, skin);
    for (let y = 7; y < 22; y++) px(19 + (y > 18 ? -1 : 0), y, 2, 1, skinD); // lado na sombra (3/4)
    px(8, 13, 1, 3, skinD); // orelha
    px(7, 13, 1, 3, OUT);
    // olhos (3/4: um pouco para a esquerda), sobrancelhas, nariz e boca
    const brow = L.hairStyle === 'careca' || L.hairStyle === 'raspado' ? '#2a1a10' : hairD;
    px(11, 12, 3, 1, brow);
    px(17, 12, 3, 1, brow);
    px(12, 14, 1, 1, '#f2f2f2');
    px(13, 14, 1, 1, OUT);
    px(18, 14, 1, 1, '#f2f2f2');
    px(19, 14, 1, 1, OUT);
    px(15, 15, 1, 3, skinD);
    px(14, 18, 2, 1, skinD);
    px(13, 19, 1, 1, skinL);
    px(13, 20, 5, 1, L.lips ?? shadeC(skin, -0.42));
    if (L.lips) px(14, 21, 3, 1, shadeC(L.lips, -0.2));
    px(11, 9, 3, 1, skinL); // luz na testa
    // pelos do rosto
    if (L.facial === 'bigode') px(12, 19, 7, 1, hairD);
    if (L.facial === 'cavanhaque') { px(13, 19, 5, 1, hairD); px(14, 21, 3, 2, hairD); }
    if (L.facial === 'barba' || L.facial === 'barba-rala') {
      const col = L.facial === 'barba' ? hairD : shadeC(skin, -0.32);
      for (let y = 16; y <= 22; y++) {
        const w = y < 19 ? 1 : 6.5 - (y - 19) * 0.9;
        if (y < 19) { px(9, y, 2, 1, col); px(20, y, 2, 1, col); } else px(Math.round(15.5 - w), y, Math.round(w * 2), 1, col);
      }
      if (L.facial === 'barba') px(12, 19, 7, 1, hairD);
      px(13, 20, 5, 1, L.lips ?? shadeC(skin, -0.5));
    }
    // cabelo por cima
    const cap = (y1: number) => { ellipse(15.5, 9, 7.5, 5, OUT, -99, y1); ellipse(15.5, 9.5, 6.8, 4.5, hair, -99, y1); };
    switch (L.hairStyle) {
      case 'curto': cap(9); px(8, 8, 2, 4, hair); px(21, 8, 2, 3, hairD); px(12, 5, 5, 1, hairL); break;
      case 'topete': cap(9); ellipse(13, 5, 6, 3, OUT); ellipse(13, 5, 5, 2.5, hair); px(10, 4, 5, 1, hairL); px(8, 8, 2, 4, hair); break;
      case 'longo': case 'juba': case 'cacheado':
        cap(9);
        px(8, 7, 2, 12, hair);
        px(21, 7, 2, 12, hairD);
        if (L.hairStyle === 'longo') px(10, 6, 6, 1, hairL);
        else for (let k = 0; k < 8; k++) px(8 + ((k * 5) % 14), 4 + (k % 3), 2, 2, k % 2 ? hairL : hairD);
        break;
      case 'rabo': cap(9); px(22, 8, 3, 2, hair); px(23, 10, 3, 9, hair); px(24, 11, 1, 6, hairL); px(8, 8, 2, 4, hair); break;
      case 'coque': cap(9); ellipse(16, 3.5, 3.5, 2.5, OUT); ellipse(16, 3.5, 2.6, 1.8, hair); px(8, 8, 2, 3, hair); break;
      case 'chanel': cap(10); px(8, 8, 3, 11, hair); px(20, 8, 3, 11, hairD); px(10, 9, 11, 2, hair); px(11, 10, 9, 1, hairL); break;
      case 'espetado':
        cap(9);
        for (let k = 0; k < 6; k++) { px(9 + k * 2, 2 + (k % 2), 1, 4, hair); px(10 + k * 2, 3 + ((k + 1) % 2), 1, 3, hairL); }
        break;
      case 'moicano': ellipse(15.5, 9.5, 6.8, 4.5, shadeC(skin, -0.18), -99, 9); for (let y = 1; y < 10; y++) px(14, y, 4, 1, y % 2 ? hair : hairL); break;
      case 'raspado': ellipse(15.5, 9.5, 6.8, 4.5, shadeC(mix(skin, hair, 0.35), 0), -99, 8); break;
      case 'careca': px(12, 6, 4, 1, skinL); break;
    }
  }
  // óculos
  if (L.glasses && !helmetOnly) {
    if (L.glasses === 'escuro' || L.glasses === 'aviador') {
      px(10, 13, 10, 1, OUT);
      px(10, 13, 4, L.glasses === 'aviador' ? 3 : 2, '#1a1e26');
      px(16, 13, 4, L.glasses === 'aviador' ? 3 : 2, '#1a1e26');
      px(11, 13, 1, 1, L.glasses === 'aviador' ? '#c8b070' : '#5a6a8a');
      px(17, 13, 1, 1, '#5a6a8a');
    } else if (L.glasses === 'redondo') {
      g.strokeStyle = OUT;
      px(10, 13, 4, 1, OUT); px(10, 15, 4, 1, OUT); px(10, 13, 1, 3, OUT); px(13, 13, 1, 3, OUT);
      px(16, 13, 4, 1, OUT); px(16, 15, 4, 1, OUT); px(16, 13, 1, 3, OUT); px(19, 13, 1, 3, OUT);
      px(14, 13, 2, 1, OUT);
    } else if (L.glasses === 'protecao') {
      px(9, 6, 14, 3, '#3a3020');
      px(10, 6, 5, 2, '#8ac8d8');
      px(17, 6, 5, 2, '#8ac8d8');
    } else if (L.glasses === 'monoculo') {
      px(17, 13, 3, 1, '#d8c040'); px(17, 15, 3, 1, '#d8c040'); px(17, 13, 1, 3, '#d8c040'); px(19, 13, 1, 3, '#d8c040');
      px(19, 16, 1, 6, '#d8c040');
    }
  }
  if (L.earring && !helmetOnly) px(7, 16, 2, 2, L.earring);
  // chapéus e afins
  const H = L.hat;
  if (H && !helmetOnly) {
    const hd = shadeC(H.color, -0.3);
    switch (H.kind) {
      case 'bone': ellipse(15.5, 7, 7.5, 3.5, OUT, -99, 8); ellipse(15.5, 7.3, 6.8, 3, H.color, -99, 8); px(4, 8, 8, 2, OUT); px(5, 8, 7, 1, hd); break;
      case 'chapeu': case 'palha':
        px(3, 7, 26, 2, OUT); px(4, 7, 24, 1, H.color);
        ellipse(15.5, 4, 6, 4, OUT, -99, 7); ellipse(15.5, 4.3, 5.2, 3.4, H.color, -99, 7);
        px(10, 6, 11, 1, H.kind === 'palha' ? '#8a3a20' : '#5a1010');
        if (H.kind === 'palha') for (let x = 5; x < 27; x += 3) px(x, 7, 1, 1, hd);
        break;
      case 'quepe': ellipse(15.5, 6, 7.5, 3.5, OUT, -99, 8); ellipse(15.5, 6.3, 6.8, 3, H.color, -99, 8); px(7, 8, 17, 2, '#1a1410'); px(14, 5, 3, 2, '#d8c040'); break;
      case 'gorro': ellipse(15.5, 7, 7.5, 5, OUT, -99, 9); ellipse(15.5, 7.3, 6.8, 4.5, H.color, -99, 9); px(8, 8, 15, 2, hd); px(14, 1, 3, 2, H.color); break;
      case 'faixa': case 'bandana': px(8, 8, 15, 2, H.color); px(8, 9, 15, 1, hd); if (H.kind === 'bandana') { px(22, 9, 3, 2, H.color); px(24, 11, 2, 2, hd); } break;
      case 'capacete-obra': ellipse(15.5, 6.5, 8, 4.5, OUT, -99, 8); ellipse(15.5, 6.8, 7.2, 4, H.color, -99, 8); px(6, 8, 20, 2, hd); px(15, 3, 2, 5, shadeC(H.color, 0.25)); break;
      case 'tiara': px(10, 5, 11, 1, H.color); px(12, 4, 1, 1, H.color); px(15, 3, 1, 2, H.color); px(18, 4, 1, 1, H.color); px(15, 4, 1, 1, '#d01818'); break;
    }
  }
  pixCache.set(key, cv);
  return cv;
}

// Quadro do retrato: arte do rival se existir (rival-<id>.png), senão o provisório em pixel art
export function drawPortrait(c: CanvasRenderingContext2D, d: Driver, r: { x: number; y: number; w: number; h: number }, frame = '#1a1614') {
  const p = rivalOf(d);
  c.fillStyle = frame;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  const im = portraitImg(`rival-${p.id}`);
  if (im) {
    // arte com fundo transparente: atrás vai o fundo na cor do carro; a arte cobre o quadro
    c.fillStyle = shadeC(d.paint, -0.35);
    c.fillRect(r.x, r.y, r.w, r.h);
    const k = Math.max(r.w / im.naturalWidth, r.h / im.naturalHeight);
    const w = im.naturalWidth * k, h = im.naturalHeight * k;
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.drawImage(im, r.x + (r.w - w) / 2, r.y + r.h - h, w, h);
    c.restore();
  } else {
    const cv = pixelPortrait(p, d.paint);
    const k = Math.max(r.w / PW, r.h / PH);
    const w = PW * k, h = PH * k;
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.drawImage(cv, Math.round(r.x + (r.w - w) / 2), Math.round(r.y + r.h - h), Math.round(w), Math.round(h));
    c.restore();
  }
  c.imageSmoothingEnabled = sm;
}

// quebra um texto em linhas que cabem na largura (fonte de pixel, tamanho dado)
export function wrapLines(c: CanvasRenderingContext2D, s: string, w: number, size = 5): string[] {
  c.font = `${size}px "Press Start 2P", monospace`;
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    const t = line ? `${line} ${word}` : word;
    if (c.measureText(t).width > w && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}
