import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { API_BASE_URL } from '../shared/config/env'

export const server = setupServer(
  http.get(`${API_BASE_URL}/gamification/me/rewards/unseen`, () =>
    HttpResponse.json({ xp: [], badges: [] }),
  ),
)
