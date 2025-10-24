export type Result<Ok, Err = Error> =
	| Readonly<{ ok: true; data: Ok }>
	| Readonly<{ ok: false; error: Err }>;

export const Result = {
	ok<Ok, Err = Error>(ok: Ok): Result<Ok, Err> {
		return { ok: true, data: ok };
	},

	error<Ok, Err = Error>(err: Err): Result<Ok, Err> {
		return { ok: false, error: err };
	},

	try<Ok, Err = Error>(fn: () => Ok): Result<Ok, Err> {
		try {
			return Result.ok(fn());
		} catch (error) {
			return Result.error(error as Err);
		}
	},

	async tryAsync<Ok, Err = Error>(
		fn: () => Promise<Ok>,
	): Promise<Result<Ok, Err>> {
		try {
			return Result.ok(await fn());
		} catch (error) {
			return Result.error(error as Err);
		}
	},

	map<NewOk, OldOk, Err>(
		result: Result<OldOk, Err>,
		mapper: (ok: OldOk) => NewOk,
	): Result<NewOk, Err> {
		if (!result.ok) {
			return result;
		}

		return Result.ok(mapper(result.data));
	},

	mapErr<Ok, NewErr, OldErr>(
		result: Result<Ok, OldErr>,
		mapper: (err: OldErr) => NewErr,
	): Result<Ok, NewErr> {
		if (result.ok) {
			return result;
		}

		return Result.error(mapper(result.error));
	},

	flatten<Ok, Err>(result: Result<Result<Ok, Err>, Err>): Result<Ok, Err> {
		if (!result.ok) {
			return result;
		}

		return result.data;
	},

	unwrap<Ok, Err>(result: Result<Ok, Err>): Ok {
		if (!result.ok) {
			throw result.error;
		}

		return result.data;
	},

	unwrapOr<Ok, Err>(result: Result<Ok, Err>, fallback: Ok): Ok {
		if (!result.ok) {
			return fallback;
		}

		return result.data;
	},

	async unwrapAsync<Ok, Err>(promise: Promise<Result<Ok, Err>>): Promise<Ok> {
		const result = await promise;
		if (!result.ok) {
			throw result.error;
		}

		return result.data;
	},

	partition<Ok, Err>(results: Array<Result<Ok, Err>>): [Array<Ok>, Array<Err>] {
		const oks: Ok[] = [];
		const errs: Err[] = [];

		for (const result of results) {
			if (!result.ok) {
				errs.push(result.error);
				continue;
			}

			oks.push(result.data);
		}

		return [oks, errs];
	},
};
