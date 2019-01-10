# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

<!-- CHANGELOG line template
### Added/Changed/Removed
- Added something, by [@johndoe](https://github.com/johndoe), in PR [#XXX](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/XXX)
### Changed (for dependency bumps)
- `core`: Bumps to [`abc@1.2.3`](https://npmjs.com/package/abc/), in PR [#XXX](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/XXX)
### Fixed
- Fix [#XXX](https://github.com/Microsoft/BotFramework-DirectLineJS/issues/XXX). Patched something, by [@johndoe](https://github.com/johndoe) in PR [#XXX](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/XXX)
-->

## [Unreleased]

## [0.10.2] - 2018-01-09
- Added `messageBack` to `CardActionTypes` and updated `CardAction` fields, by [@corinagum](https://github.com/corinagum), in PR [#138](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/138)
- Expand `CardAction`s with specific types, by [@corinagum](https://github.com/corinagum), in PR [#141](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/141)

## [0.10.1] - 2018-12-21
### Changed

- Prevents infinite WebSocket reconnection spam on subsequent token expiration signals [#127](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/127)

## [0.10.0] - 2018-10-30
### Added
- Add support for watermark in Web Socket, in [#96](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/96)

### Changed
- Delay before retrying Web Socket, in [#97](https://github.com/Microsoft/BotFramework-WebChat/pull/97)
- Slow down polling on congested traffic, in [#98](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/98)
- Bump dependencies, in [#100](https://github.com/Microsoft/BotFramework-DirectLineJS/pull/100)
   - `deep-extend` from `0.4.2` to `0.5.1`
   - `randomatic` from `1.1.7` to `3.1.0`

## [0.9.17] - 2018-08-31
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
