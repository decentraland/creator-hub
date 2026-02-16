PROTOBUF_VERSION = 21.12
UNAME_S := $(shell uname)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
    ifeq ($(UNAME_M),arm64)
        PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-universal_binary.zip
    else
        PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-x86_64.zip
    endif
else ifeq ($(UNAME_S),Linux)
    ifeq ($(UNAME_M),aarch64)
        PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-aarch_64.zip
    else
        PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-x86_64.zip
    endif
else
    PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-win64.zip
endif

PROTOC = node_modules/.bin/protobuf/bin/protoc
INSPECTOR_PATH = packages/inspector
CH_PATH = packages/creator-hub
ASSET_PACKS_PATH = packages/asset-packs
SYNC_PACK = node_modules/.bin/syncpack

install:
	npm i --silent

install-all:
	make install
	make install-protoc
	make install-asset-packs
	make install-inspector
	make install-creator-hub

install-asset-packs:
	cd $(ASSET_PACKS_PATH); npm i --silent

install-inspector:
	make install-protoc
	cd $(INSPECTOR_PATH); npm i --silent

install-creator-hub:
	cd $(CH_PATH); npm i --silent
	make init-submodules

init-submodules:
	git submodule update --init --recursive

install-protoc:
	mkdir -p node_modules/.bin/protobuf
	@echo "Downloading protoc $(PROTOBUF_VERSION) for $(UNAME_S) $(UNAME_M)..."
	@echo "Target file: $(PROTOBUF_ZIP)"
	rm -f $(PROTOBUF_ZIP)
	curl -fsSL --retry 3 --retry-delay 2 -o $(PROTOBUF_ZIP) \
		https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOBUF_VERSION)/$(PROTOBUF_ZIP) || \
		(echo "Failed to download protoc. File size: $$(stat -c%s $(PROTOBUF_ZIP) 2>/dev/null || stat -f%z $(PROTOBUF_ZIP) 2>/dev/null || echo 'N/A')"; exit 1)
	@echo "Downloaded file size: $$(stat -c%s $(PROTOBUF_ZIP) 2>/dev/null || stat -f%z $(PROTOBUF_ZIP) 2>/dev/null || echo 'N/A') bytes"
	@file $(PROTOBUF_ZIP) || true
	unzip -o $(PROTOBUF_ZIP) -d node_modules/.bin/protobuf
	rm $(PROTOBUF_ZIP)
	chmod +x $(PROTOC)

protoc:
	mkdir -p $(INSPECTOR_PATH)/src/lib/data-layer/proto/gen
	$(PROTOC) \
		--plugin=node_modules/.bin/protoc-gen-dcl_ts_proto \
		--dcl_ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions,fileSuffix=.gen,oneof=unions,useMapType=true \
		--dcl_ts_proto_out=$(INSPECTOR_PATH)/src/lib/data-layer/proto/gen \
		--proto_path=$(INSPECTOR_PATH)/src/lib/data-layer/proto \
		$(INSPECTOR_PATH)/src/lib/data-layer/proto/*.proto

build:
	make build-asset-packs
	make build-inspector
	make build-creator-hub

build-asset-packs:
	cd $(ASSET_PACKS_PATH); npm run build;

build-inspector:
	cd $(INSPECTOR_PATH); npm run build;

build-creator-hub:
	cd $(CH_PATH); npm run build;

init:
	make clean
	make install-all
	make protoc
	make build

lint:
	npm run lint

lint-fix:
	make sync-deps
	npm run lint:fix

sync-deps:
	npm run syncpack:format
	npm run syncpack:fix

lint-packages:
	npm run syncpack:list-mismatches
	npm run syncpack:format

typecheck:
	npm run typecheck --if-present

test:
	npm run test

validate-asset-packs:
	cd $(ASSET_PACKS_PATH); npm run validate

upload-asset-packs:
	cd $(ASSET_PACKS_PATH); npm run upload

test-e2e:
	make test-inspector-e2e
	make test-creator-hub-e2e

test-inspector-e2e:
	cd $(INSPECTOR_PATH)/; npm run test:e2e

test-creator-hub-e2e:
	cd $(CH_PATH); npm run test:e2e

format:
	npm run format

format-fix:
	npm run format:fix

deep-clean:
	rm -rf node_modules/ \
		$(INSPECTOR_PATH)/node_modules/ \
		$(CH_PATH)/node_modules/ \
		$(ASSET_PACKS_PATH)/node_modules/ \
		$(INSPECTOR_PATH)/src/lib/data-layer/proto/gen/ \
	make clean

clean:
	@echo "> Cleaning all folders"
	@rm -rf coverage/
	@rm -rf $(INSPECTOR_PATH)/public/*.js $(INSPECTOR_PATH)/public/*.d.ts $(INSPECTOR_PATH)/public/*.map $(INSPECTOR_PATH)/public/*.css
	@rm -rf $(CH_PATH)/main/dist/
	@rm -rf $(CH_PATH)/preload/dist/
	@rm -rf $(CH_PATH)/renderer/dist/
	@rm -rf $(ASSET_PACKS_PATH)/dist/
	@rm -rf $(ASSET_PACKS_PATH)/bin/
