export interface CategoryBucket {
  label: string;
  categorias: string[];
  hints: string[];
}

export const BUCKET_LIST_SLUG = 'buckets-de-busca';

export const BUCKETS: CategoryBucket[] = [
  {
    label: 'shows-sertanejo',
    categorias: ['Show', 'Festival'],
    hints: ['shows sertanejos', 'agenda sertanejo', 'festival sertanejo', 'buteco', 'camarote sertanejo'],
  },
  {
    label: 'shows-samba-pagode-forro-mpb',
    categorias: ['Show', 'Festival'],
    hints: ['shows samba', 'shows pagode', 'shows forró', 'shows MPB', 'roda de samba'],
  },
  {
    label: 'shows-rock-pop-indie',
    categorias: ['Show', 'Festival'],
    hints: ['shows rock', 'shows pop', 'shows indie', 'concerto', 'festival rock'],
  },
  {
    label: 'shows-eletronica-hiphop-funk',
    categorias: ['Show', 'Festival'],
    hints: ['festas eletrônicas', 'shows hip hop', 'shows funk', 'baile'],
  },
  {
    label: 'shows-gospel-jazz-classica',
    categorias: ['Show', 'Festival'],
    hints: ['shows gospel', 'shows jazz', 'concerto música clássica', 'orquestra'],
  },
  {
    label: 'shows-internacional-tributos',
    categorias: ['Show', 'Festival'],
    hints: ['shows internacionais', 'tributos', 'cover'],
  },
  {
    label: 'teatro-danca-standup',
    categorias: ['Peça'],
    hints: ['peças de teatro', 'espetáculos de dança', 'stand up comedy', 'ballet', 'ópera'],
  },
  {
    label: 'exposicoes-arte',
    categorias: ['Exposição'],
    hints: ['exposições', 'museus agenda', 'mostras de arte', 'galerias'],
  },
  {
    label: 'cinema-mostras',
    categorias: ['Cinema'],
    hints: ['cinema alternativo', 'mostra de cinema', 'cineclube', 'estreias'],
  },
  {
    label: 'feiras-mercados',
    categorias: ['Feira'],
    hints: ['feiras culturais', 'feira criativa', 'mercado', 'brechó', 'feira de artesanato'],
  },
  {
    label: 'gastronomia-festivais',
    categorias: ['Festival', 'Outro'],
    hints: ['festival gastronômico', 'festival cerveja', 'food truck', 'festival vinho'],
  },
  {
    label: 'familia-infantil',
    categorias: ['Peça', 'Show', 'Outro'],
    hints: ['eventos infantis', 'peças infantis', 'espetáculo infantil', 'programação criança'],
  },
];
