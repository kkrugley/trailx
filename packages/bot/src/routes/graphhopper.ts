import type { FastifyInstance } from 'fastify'

export async function graphhopperRoutes(fastify: FastifyInstance) {
  fastify.post('/api/route', async (request, reply) => {
    const apiKey = process.env.GRAPHHOPPER_API_KEY
    if (!apiKey) {
      return reply.status(500).send({ error: 'GraphHopper key not configured' })
    }

    const response = await fetch(
      `https://graphhopper.com/api/1/route?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      },
    )

    const data = await response.json()
    return reply.status(response.status).send(data)
  })
}
