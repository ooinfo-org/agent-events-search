import { z } from 'zod';

const TIPO_LOCAL_ENUM = ['Teatro', 'Casa de Shows', 'Centro Cultural', 'Museu', 'Galeria', 'Bar', 'Restaurante', 'Estádio', 'Espaço Público', 'Outro'] as const;
const TIPO_ARTISTA_ENUM = ['Banda', 'Solo', 'Grupo', 'DJ', 'Companhia', 'Palestrante', 'Outro'] as const;
const TIPO_ORG_ENUM = ['Produtora', 'Instituição Pública', 'ONG', 'Coletivo', 'Patrocinador', 'Empresa', 'Outro'] as const;

export const EventoSchema = z.object({
  titulo: z.string().describe('Nome/título do evento'),
  descricao: z.string().describe('Descrição curta (1-3 frases)'),
  tipo_evento: z
    .enum(['Show', 'Peça', 'Festival', 'Feira', 'Exposição', 'Cinema', 'Palestra', 'Outro'])
    .describe('Categoria do evento'),
  genero_musical: z.string().nullable().describe('Gênero musical quando aplicável (Show/Festival), senão null'),
  data_inicio: z.string().describe('Data de início no formato ISO YYYY-MM-DD'),
  data_fim: z.string().nullable().describe('Data de fim ISO YYYY-MM-DD, ou null se evento de 1 dia'),
  horario: z.string().nullable().describe('Horário HH:MM, ou null se desconhecido'),
  local: z.string().describe('Nome do espaço/venue'),
  endereco: z.string().nullable().describe('Endereço textual, ou null'),
  link_evento: z.string().url().describe('URL da página oficial ou de venda de ingressos'),
  link_foto: z.string().url().nullable().describe('URL da imagem/cartaz do evento, ou null'),
  ingresso: z
    .object({
      preco: z.string().nullable().describe('Preço em texto (ex: "R$ 50" ou "Gratuito")'),
      plataforma: z.string().nullable().describe('Ex: Sympla, Ingresso.com, bilheteria'),
    })
    .describe('Informações de ingresso'),
  fonte_url: z.string().url().describe('URL da fonte de onde a informação foi extraída'),
  local_detalhes: z
    .object({
      tipo: z.enum(TIPO_LOCAL_ENUM).nullable().describe('Classificação do venue'),
      bairro: z.string().nullable(),
      site: z.string().url().nullable(),
    })
    .describe('Detalhes do venue (para upsert em Locais Culturais)'),
  artistas: z
    .array(
      z.object({
        nome_artistico: z.string(),
        tipo: z.enum(TIPO_ARTISTA_ENUM).nullable(),
      }),
    )
    .describe('Artistas/bandas/palestrantes envolvidos, separados. Ex: para "Chitãozinho & Xororó" retornar 2 itens.'),
  organizacoes: z
    .array(
      z.object({
        nome: z.string(),
        tipo: z.enum(TIPO_ORG_ENUM).nullable(),
      }),
    )
    .describe('Produtoras, patrocinadores, instituições que organizam. Se desconhecido, array vazio.'),
});

export type Evento = z.infer<typeof EventoSchema>;

export const CapitalEventosSchema = z.object({
  capital: z.string(),
  uf: z.string(),
  coletado_em: z.string().describe('ISO datetime da coleta'),
  eventos: z.array(EventoSchema),
});

export type CapitalEventos = z.infer<typeof CapitalEventosSchema>;

export const eventoJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventos'],
  properties: {
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'titulo',
          'descricao',
          'tipo_evento',
          'genero_musical',
          'data_inicio',
          'data_fim',
          'horario',
          'local',
          'endereco',
          'link_evento',
          'link_foto',
          'ingresso',
          'fonte_url',
          'local_detalhes',
          'artistas',
          'organizacoes',
        ],
        properties: {
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          tipo_evento: {
            type: 'string',
            enum: ['Show', 'Peça', 'Festival', 'Feira', 'Exposição', 'Cinema', 'Palestra', 'Outro'],
          },
          genero_musical: { type: ['string', 'null'] },
          data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
          data_fim: { type: ['string', 'null'], description: 'YYYY-MM-DD ou null' },
          horario: { type: ['string', 'null'], description: 'HH:MM ou null' },
          local: { type: 'string' },
          endereco: { type: ['string', 'null'] },
          link_evento: { type: 'string' },
          link_foto: { type: ['string', 'null'] },
          ingresso: {
            type: 'object',
            additionalProperties: false,
            required: ['preco', 'plataforma'],
            properties: {
              preco: { type: ['string', 'null'] },
              plataforma: { type: ['string', 'null'] },
            },
          },
          fonte_url: { type: 'string' },
          local_detalhes: {
            type: 'object',
            additionalProperties: false,
            required: ['tipo', 'bairro', 'site'],
            properties: {
              tipo: {
                type: ['string', 'null'],
                enum: ['Teatro', 'Casa de Shows', 'Centro Cultural', 'Museu', 'Galeria', 'Bar', 'Restaurante', 'Estádio', 'Espaço Público', 'Outro', null],
              },
              bairro: { type: ['string', 'null'] },
              site: { type: ['string', 'null'] },
            },
          },
          artistas: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['nome_artistico', 'tipo'],
              properties: {
                nome_artistico: { type: 'string' },
                tipo: {
                  type: ['string', 'null'],
                  enum: ['Banda', 'Solo', 'Grupo', 'DJ', 'Companhia', 'Palestrante', 'Outro', null],
                },
              },
            },
          },
          organizacoes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['nome', 'tipo'],
              properties: {
                nome: { type: 'string' },
                tipo: {
                  type: ['string', 'null'],
                  enum: ['Produtora', 'Instituição Pública', 'ONG', 'Coletivo', 'Patrocinador', 'Empresa', 'Outro', null],
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
