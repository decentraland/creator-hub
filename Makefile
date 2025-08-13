
PROTOBUF_VERSION = 3.20.1
ifeq ($(shell uname),Darwin)
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-x86_64.zip
else
ifeq ($(shell arch),aarch64)
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-aarch_64.zip
else
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-x86_64.zip
endif
endif

PROTOC = node_modules/.bin/protobuf/bin/protoc
INSPECTOR_PATH = packages/inspector
CH_PATH = packages/creator-hub
TSC = node_modules/.bin/tsc
ESLINT = node_modules/.bin/eslint
SYNC_PACK = node_modules/.bin/syncpack
JEST = node_modules/.bin/jest

install:
	npm i --silent
	make install-protobuf

lint:
	npm run lint

typecheck:
	npm run typecheck --if-present

sync-deps:
	$(SYNC_PACK) format --config .syncpackrc.json --source "packages/*/package.json" --source "package.json"
	$(SYNC_PACK) fix-mismatches --config .syncpackrc.json --source "packages/*/package.json" --source "package.json"

lint-packages:
	$(SYNC_PACK) list-mismatches --config .syncpackrc.json  --source "packages/*/package.json" --source "package.json"
	$(SYNC_PACK) format --config .syncpackrc.json  --source "packages/*/package.json" --source "package.json"

lint-fix: sync-deps
	npm run lint -- --fix

test:
	npm run test

test-e2e:
	make test-inspector-e2e
	make test-creator-hub-e2e

test-inspector-e2e:
	cd $(INSPECTOR_PATH)/; npm run test:e2e

test-creator-hub-e2e:
	cd $(CH_PATH); npm run test:e2e

format:
	npm run format -- --loglevel=error

install-protobuf:
	curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOBUF_VERSION)/$(PROTOBUF_ZIP)
	unzip -o $(PROTOBUF_ZIP) -d node_modules/.bin/protobuf
	rm $(PROTOBUF_ZIP)
	chmod +x $(PROTOC)

build:
	make clean
	make install
	make build-creator-hub

build-creator-hub:
	cd $(CH_PATH); npm i --silent; npm run build;

deep-clean:
	rm -rf node_modules/ \
		$(INSPECTOR_PATH)/node_modules/ \
		$(CH_PATH)/node_modules/
	make clean

clean:
	@echo "> Cleaning all folders"
	@rm -rf coverage/
	@rm -rf $(INSPECTOR_PATH)/public/*.js $(INSPECTOR_PATH)/public/*.d.ts $(INSPECTOR_PATH)/public/*.map $(INSPECTOR_PATH)/public/*.css
	@rm -rf $(CH_PATH)/main/dist/
	@rm -rf $(CH_PATH)/preload/dist/
	@rm -rf $(CH_PATH)/renderer/dist/
