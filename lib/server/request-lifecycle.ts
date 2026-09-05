type RouteHandler = (request: Request) => Response | Promise<Response>;

/**
 * A header/auth rejection can finish before the request body is consumed.
 * Vinext's Node-to-Web bridge applies backpressure to IncomingMessage; leaving
 * that body open can strand the keep-alive socket and reset the next request.
 * Cancelling the unused body invokes the bridge's existing discard-and-resume
 * path. It does not buffer the rejected upload or relax any application limits.
 */
export function withRequestBodyCleanup(
  handler: RouteHandler,
): (request: Request) => Promise<Response> {
  return async (request) => {
    let response: Response | undefined;
    try {
      response = await handler(request);
      return response;
    } finally {
      const body = request.body;
      // A response may intentionally forward the request stream, or retain a
      // reader for streaming work. Never cancel a stream its consumer still owns.
      if (body && !body.locked && body !== response?.body) {
        // Do not wait for a tee's other branch or for a disconnected uploader.
        // The bridge's cancel hook starts synchronously; failures cannot replace
        // the already chosen application response with a generic server error.
        void body.cancel().catch(() => {});
      }
    }
  };
}
