import { IntuitDevOauthController } from '@plugins/intuit/src/intuit-dev-oauth.controller'
import type { IntuitOauthService } from '@plugins/intuit/src/intuit-oauth.service'
import type { Response } from 'express'

describe('IntuitDevOauthController', () => {
  it('redirige (302) a la authorize URL que arma connect', async () => {
    const oauth = {
      connect: jest.fn().mockResolvedValue({ authorizeUrl: 'https://intuit.test/authorize?x=1' }),
    } as unknown as IntuitOauthService
    const redirect = jest.fn()
    const res = { redirect } as unknown as Response

    await new IntuitDevOauthController(oauth).intuit('11111111-1111-1111-1111-111111111111', res)

    expect(oauth.connect).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
    expect(redirect).toHaveBeenCalledWith('https://intuit.test/authorize?x=1')
  })
})
