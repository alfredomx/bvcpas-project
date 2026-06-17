import { IntuitClientController } from '@plugins/intuit/src/intuit-client.controller'
import { IntuitTokensNotFoundError } from '@plugins/intuit/src/intuit.errors'
import type { IntuitOauthService } from '@plugins/intuit/src/intuit-oauth.service'
import type { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'

function ctrl(over: { oauth?: Partial<IntuitOauthService>; tokens?: Partial<IntuitTokensService> } = {}) {
  const oauth = {
    connect: jest.fn().mockResolvedValue({ authorizeUrl: 'https://intuit.test/x' }),
    ...over.oauth,
  } as unknown as IntuitOauthService
  const tokens = {
    deleteByClientId: jest.fn().mockResolvedValue(true),
    ...over.tokens,
  } as unknown as IntuitTokensService
  return { c: new IntuitClientController(oauth, tokens), oauth, tokens }
}

describe('IntuitClientController', () => {
  it('reconnect delega en oauth.connect', async () => {
    const { c, oauth } = ctrl()
    const res = await c.reconnect('c1')
    expect(oauth.connect).toHaveBeenCalledWith('c1')
    expect(res).toEqual({ authorizeUrl: 'https://intuit.test/x' })
  })

  it('disconnect borra los tokens → { deleted: true }', async () => {
    const { c, tokens } = ctrl()
    expect(await c.disconnect('c1')).toEqual({ deleted: true })
    expect(tokens.deleteByClientId).toHaveBeenCalledWith('c1')
  })

  it('disconnect de un cliente sin conexión → TOKENS_NOT_FOUND', async () => {
    const { c } = ctrl({ tokens: { deleteByClientId: jest.fn().mockResolvedValue(false) } })
    await expect(c.disconnect('c1')).rejects.toBeInstanceOf(IntuitTokensNotFoundError)
  })
})
