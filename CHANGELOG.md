# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Add handling of 403/500 for `getSessionId`, in [#87](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/87)

## [0.9.16] - 2018-08-14
### Added
- Added optional `role` to `User` interface, must be either `"bot"`, `"channel"`, or `"user"`, in [#79](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/79)

## [0.9.15] - 2018-04-24
### Added
- OAuthCard and `getSessionId` in PR #67
  - Add OAuthCard ([`c7b8af7`](https://github.com/Microsoft/BotFramework-DirectLineJS/commit/c7b8af7be35685c220f2d777daa96f52d757f53f))
  - Add `getSessionId` ([`9c87aa3`](https://github.com/Microsoft/BotFramework-DirectLineJS/commit/9c87aa3f54947ea2fee836b41eec8ec45297a57a), [`9a2b2d8`](https://github.com/Microsoft/BotFramework-DirectLineJS/commit/9a2b2d889af48e558f563758aa01d498b2b2cf49), [`df84d00`](df84d0054f784ae5eb36784ef07a2aa38ca6c95b), [`92cc331`](92cc33138dfbdd533b4d14f6be275d1c86ef8db4))
