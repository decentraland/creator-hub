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
SYNC_PACK = node_modules/.bin/syncpack

install:
	npm i --silent
	make install-protoc
	cd $(INSPECTOR_PATH); npm i --silent;
	cd $(CH_PATH); npm i --silent;

install-protoc:
	mkdir -p node_modules/.bin/protobuf
	curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOBUF_VERSION)/$(PROTOBUF_ZIP)
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
	make build-inspector
	make build-creator-hub

build-inspector:
	cd $(INSPECTOR_PATH); npm run build;

build-creator-hub:
	cd $(CH_PATH); npm run build;

init:
	make clean
	make install
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
    $(INSPECTOR_PATH)/src/lib/data-layer/proto/gen/ \
	make clean

clean:
	@echo "> Cleaning all folders"
	@rm -rf coverage/
	@rm -rf $(INSPECTOR_PATH)/public/*.js $(INSPECTOR_PATH)/public/*.d.ts $(INSPECTOR_PATH)/public/*.map $(INSPECTOR_PATH)/public/*.css
	@rm -rf $(CH_PATH)/main/dist/
	@rm -rf $(CH_PATH)/preload/dist/
	@rm -rf $(CH_PATH)/renderer/dist/
