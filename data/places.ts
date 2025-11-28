// data/places.ts

export type Place = {
  id: string       // для пути в облаке
  title: string    // человекочитаемое название, пойдёт в запрос к Pixabay
}

export const PLACES: Record<string, Place[]> = {
  kaliningrad: [
    { id: 'kafedralny-sobor', title: 'Кафедральный собор Калининград' },
    { id: 'rybnaya-derevnya', title: 'Рыбная деревня Калининград' },
    // добавишь сюда ещё достопримечательности
  ],

  moscow: [
    { id: 'krasnaya-ploshchad', title: 'Красная площадь Москва' },
    { id: 'vdnh', title: 'ВДНХ Москва' },
  ],

  // и т.д. по другим городам
}
